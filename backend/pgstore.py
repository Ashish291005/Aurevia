"""Postgres (Supabase) document store with the small Motor/MongoDB API subset server.py uses.

Each collection is a table `(pk bigserial, doc jsonb)`. Filters are translated to SQL so that
conditional updates (e.g. stock reservation `{"stock": {"$gte": n}}` + `$inc`) stay atomic.

Supported: find / find_one / insert_one / insert_many / update_one / update_many (with $set,
$inc, $push, upsert) / delete_one / count_documents / create_index, filters with equality
(including dotted paths and array membership), $ne, $gt(e), $lt(e), $in, $or, $exists,
projections, single-field sort and limits.
"""
import asyncio
import json
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import asyncpg
from bson import ObjectId

_NAME = re.compile(r"^[a-z_][a-z0-9_]*$")


def _encode(value: Any) -> Any:
    if isinstance(value, datetime):
        return {"$date": value.isoformat()}
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, dict):
        return {k: _encode(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_encode(v) for v in value]
    return value


def _decode(value: Any) -> Any:
    if isinstance(value, dict):
        if set(value) == {"$date"}:
            return datetime.fromisoformat(value["$date"])
        return {k: _decode(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_decode(v) for v in value]
    return value


def _nest(path: str, value: Any) -> dict:
    """'customer.email', x -> {"customer": {"email": x}} (jsonb containment also matches arrays of objects)."""
    out: Any = value
    for part in reversed(path.split(".")):
        out = {part: out}
    return out


class _Sql:
    def __init__(self):
        self.args: List[Any] = []

    def arg(self, value: Any) -> str:
        self.args.append(value)
        return f"${len(self.args)}"

    def path(self, field: str) -> str:
        return self.arg(field.split("."))

    def where(self, flt: Optional[dict]) -> str:
        if not flt:
            return "TRUE"
        parts = []
        for key, cond in flt.items():
            if key == "$or":
                parts.append("(" + " OR ".join(self.where(c) for c in cond) + ")")
            elif isinstance(cond, dict) and cond and all(k.startswith("$") for k in cond):
                parts.extend(self.op(key, op, val) for op, val in cond.items())
            else:
                parts.append(self.eq(key, cond))
        return "(" + " AND ".join(parts) + ")"

    def eq(self, field: str, value: Any) -> str:
        value = _encode(value)
        if isinstance(value, (dict, list)):
            return f"doc @> {self.arg(json.dumps(_nest(field, value)))}::jsonb"
        # Scalars use a lax-mode JSON path, which (like MongoDB) looks inside arrays along the way:
        # {"items.product_id": x} matches any item, {"images": url} matches any element.
        # The @? operator is served by the jsonb_path_ops GIN index.
        path = "$" + "".join(f".{json.dumps(part)}" for part in field.split("."))
        return f"doc @? {self.arg(f'{path} ? (@ == {json.dumps(value)})')}::jsonpath"

    def op(self, field: str, op: str, value: Any) -> str:
        if op == "$ne":
            return f"NOT {self.eq(field, value)}"
        if op == "$in":
            return "(" + (" OR ".join(self.eq(field, v) for v in value) or "FALSE") + ")"
        if op == "$exists":
            expr = f"(doc #> {self.path(field)}::text[]) IS NOT NULL"
            return expr if value else f"NOT {expr}"
        if op in ("$gt", "$gte", "$lt", "$lte"):
            sym = {"$gt": ">", "$gte": ">=", "$lt": "<", "$lte": "<="}[op]
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                return f"jsonb_typeof(doc #> {self.path(field)}::text[]) = 'number' AND (doc #>> {self.path(field)}::text[])::numeric {sym} {self.arg(value)}"
            return f"(doc #>> {self.path(field)}::text[]) {sym} {self.arg(str(_encode(value)))}"
        raise NotImplementedError(f"Unsupported operator {op}")


def _project(doc: dict, projection: Optional[dict]) -> dict:
    if not projection:
        return doc
    include = {k for k, v in projection.items() if v and k != "_id"}
    if include:
        out: Dict[str, Any] = {}
        for key in include:
            head, _, rest = key.partition(".")
            if head not in doc:
                continue
            if rest and isinstance(doc[head], dict):
                out.setdefault(head, {}).update(_project(doc[head], {rest: 1}))
            else:
                out[head] = doc[head]
        if projection.get("_id", 1) and "_id" in doc:
            out["_id"] = doc["_id"]
        return out
    out = {k: v for k, v in doc.items() if projection.get(k, 1)}
    return out


class _Result:
    def __init__(self, matched=0, modified=0, deleted=0, inserted_id=None, inserted_ids=None):
        self.matched_count, self.modified_count, self.deleted_count = matched, modified, deleted
        self.inserted_id, self.inserted_ids = inserted_id, inserted_ids


class Cursor:
    def __init__(self, coll: "Collection", flt, projection):
        self.coll, self.flt, self.projection = coll, flt, projection
        self._sort: Optional[Tuple[str, int]] = None

    def sort(self, field: str, direction: int = 1) -> "Cursor":
        self._sort = (field, direction)
        return self

    async def to_list(self, length: Optional[int] = None) -> List[dict]:
        q = _Sql()
        sql = f"SELECT doc FROM {self.coll.table} WHERE {q.where(self.flt)}"
        if self._sort:
            field, direction = self._sort
            sql += f" ORDER BY doc #> {q.path(field)}::text[] {'DESC' if direction < 0 else 'ASC'} NULLS LAST, pk"
        else:
            sql += " ORDER BY pk"
        if length:
            sql += f" LIMIT {int(length)}"
        await self.coll.ensure()
        rows = await (await self.coll.db.get_pool()).fetch(sql, *q.args)
        return [_project(_decode(json.loads(r["doc"])), self.projection) for r in rows]

    def __aiter__(self):
        async def gen():
            for doc in await self.to_list(None):
                yield doc
        return gen()


class Collection:
    def __init__(self, db: "PgDatabase", name: str):
        if not _NAME.match(name):
            raise ValueError(f"Bad collection name {name}")
        self.db, self.name, self.table = db, name, f"docs_{name}"

    async def ensure(self):
        if self.name in self.db.ready:
            return
        await (await self.db.get_pool()).execute(f"CREATE TABLE IF NOT EXISTS {self.table} (pk bigserial PRIMARY KEY, doc jsonb NOT NULL)")
        await (await self.db.get_pool()).execute(f"CREATE INDEX IF NOT EXISTS {self.table}_gin ON {self.table} USING gin (doc jsonb_path_ops)")
        # Supabase exposes the public schema through its Data API; RLS with no policies blocks that path.
        # The backend connects as the table owner, which bypasses RLS, so it is unaffected.
        await (await self.db.get_pool()).execute(f"ALTER TABLE {self.table} ENABLE ROW LEVEL SECURITY")
        self.db.ready.add(self.name)

    async def create_index(self, field: str, unique: bool = False, **_ignored):
        await self.ensure()
        if not _NAME.match(field):
            raise ValueError(field)
        kind = "UNIQUE INDEX" if unique else "INDEX"
        await (await self.db.get_pool()).execute(f"CREATE {kind} IF NOT EXISTS {self.table}_{field}_idx ON {self.table} ((doc->>'{field}'))")

    def find(self, flt: Optional[dict] = None, projection: Optional[dict] = None) -> Cursor:
        return Cursor(self, flt or {}, projection)

    async def find_one(self, flt: Optional[dict] = None, projection: Optional[dict] = None) -> Optional[dict]:
        rows = await self.find(flt, projection).to_list(1)
        return rows[0] if rows else None

    async def count_documents(self, flt: Optional[dict] = None) -> int:
        await self.ensure()
        q = _Sql()
        return await (await self.db.get_pool()).fetchval(f"SELECT count(*) FROM {self.table} WHERE {q.where(flt)}", *q.args)

    async def insert_one(self, doc: dict) -> _Result:
        await self.ensure()
        doc.setdefault("_id", str(ObjectId()))
        try:
            await (await self.db.get_pool()).execute(f"INSERT INTO {self.table} (doc) VALUES ($1::jsonb)", json.dumps(_encode(doc)))
        except asyncpg.UniqueViolationError as e:
            raise DuplicateKeyError(str(e)) from e
        return _Result(inserted_id=doc["_id"])

    async def insert_many(self, docs: List[dict]) -> _Result:
        ids = [(await self.insert_one(d)).inserted_id for d in docs]
        return _Result(inserted_ids=ids)

    def _update_expr(self, q: _Sql, update: dict) -> str:
        expr = "doc"
        for op, fields in update.items():
            for field, value in fields.items():
                if "." in field:
                    raise NotImplementedError("Dotted update paths are not supported")
                key = q.arg([field])
                if op == "$set":
                    expr = f"jsonb_set({expr}, {key}::text[], {q.arg(json.dumps(_encode(value)))}::jsonb, true)"
                elif op == "$inc":
                    expr = f"jsonb_set({expr}, {key}::text[], to_jsonb(COALESCE(({expr} #>> {key}::text[])::numeric, 0) + {q.arg(value)}::numeric), true)"
                elif op == "$push":
                    expr = (f"jsonb_set({expr}, {key}::text[], COALESCE({expr} #> {key}::text[], '[]'::jsonb) || "
                            f"jsonb_build_array({q.arg(json.dumps(_encode(value)))}::jsonb), true)")
                else:
                    raise NotImplementedError(f"Unsupported update operator {op}")
        return expr

    async def _update(self, flt: dict, update: dict, many: bool, upsert: bool) -> _Result:
        await self.ensure()
        q = _Sql()
        expr = self._update_expr(q, update)
        where = q.where(flt)
        target = f"SELECT pk FROM {self.table} WHERE {where}" + ("" if many else " LIMIT 1 FOR UPDATE")
        rows = await (await self.db.get_pool()).fetch(f"UPDATE {self.table} SET doc = {expr} WHERE pk IN ({target}) RETURNING pk", *q.args)
        if not rows and upsert:
            base = {k: v for k, v in flt.items() if not k.startswith("$") and not isinstance(v, dict)}
            for k, v in update.get("$set", {}).items():
                base[k] = v
            await self.insert_one(base)
            return _Result(matched=0, modified=0)
        return _Result(matched=len(rows), modified=len(rows))

    async def update_one(self, flt: dict, update: dict, upsert: bool = False) -> _Result:
        return await self._update(flt, update, many=False, upsert=upsert)

    async def update_many(self, flt: dict, update: dict) -> _Result:
        return await self._update(flt, update, many=True, upsert=False)

    async def delete_one(self, flt: dict) -> _Result:
        await self.ensure()
        q = _Sql()
        rows = await (await self.db.get_pool()).fetch(
            f"DELETE FROM {self.table} WHERE pk IN (SELECT pk FROM {self.table} WHERE {q.where(flt)} LIMIT 1) RETURNING pk", *q.args)
        return _Result(deleted=len(rows))


class DuplicateKeyError(Exception):
    pass


class PgDatabase:
    def __init__(self, dsn: str):
        self.dsn = dsn
        self.ready: set = set()
        self._colls: Dict[str, Collection] = {}
        # asyncpg pools are bound to the event loop that created them, so keep one per loop
        # (normally there is exactly one; test clients and some serverless runtimes use several).
        self._pools: Dict[Any, asyncpg.Pool] = {}

    async def get_pool(self) -> asyncpg.Pool:
        loop = asyncio.get_running_loop()
        pool = self._pools.get(loop)
        if pool is None or pool._closed:
            # statement_cache_size=0 keeps it compatible with Supabase's transaction pooler (port 6543).
            pool = await asyncpg.create_pool(self.dsn, min_size=1, max_size=5, statement_cache_size=0)
            self._pools[loop] = pool
        return pool

    async def connect(self):
        await self.get_pool()

    async def close(self):
        pool = self._pools.pop(asyncio.get_running_loop(), None)
        if pool:
            await pool.close()

    def __getitem__(self, name: str) -> Collection:
        if name not in self._colls:
            self._colls[name] = Collection(self, name)
        return self._colls[name]

    def __getattr__(self, name: str) -> Collection:
        if name.startswith("_"):
            raise AttributeError(name)
        return self[name]
