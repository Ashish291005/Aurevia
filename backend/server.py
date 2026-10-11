from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, Request, HTTPException, Response, Depends, UploadFile, File
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import json
import uuid
import logging
import bcrypt
import jwt
import secrets
from pathlib import Path
from typing import Annotated, List, Optional, Literal
from pydantic import AfterValidator, BaseModel, Field, field_validator
from datetime import datetime, timezone, timedelta
from bson import ObjectId

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

mongo_url = os.environ.get('MONGO_URL', '')
if mongo_url.startswith(("mongodb://", "mongodb+srv://")):
    client = AsyncIOMotorClient(mongo_url)
    USING_MEMORY_DB = False
else:
    # Dev fallback so the app runs without a database. Data is lost when the server restarts.
    from mongomock_motor import AsyncMongoMockClient
    client = AsyncMongoMockClient()
    USING_MEMORY_DB = True
    logger.warning("MONGO_URL is not a valid MongoDB URL - using an IN-MEMORY database. Changes will be lost on restart.")
db = client[os.environ.get('DB_NAME', 'aurevia')]

app = FastAPI(title="Aurevia API")
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now_utc().isoformat()


def as_utc(dt: datetime) -> datetime:
    # MongoDB returns naive datetimes (in UTC); make them comparable with aware ones.
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def normalize_email(value: str) -> str:
    value = value.strip().lower()
    if not EMAIL_RE.match(value):
        raise ValueError("Please enter a valid email address")
    return value


Email = Annotated[str, AfterValidator(normalize_email)]


# ---------- Auth helpers ----------

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": now_utc() + timedelta(minutes=15), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": now_utc() + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, user_id: str, email: str):
    response.set_cookie(key="access_token", value=create_access_token(user_id, email), httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=create_refresh_token(user_id), httponly=True, secure=False, samesite="lax", max_age=604800, path="/")


def public_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]), "email": user["email"], "name": user.get("name", ""),
        "role": user.get("role", "user"), "created_at": user.get("created_at"),
    }


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_optional_user(request: Request) -> Optional[dict]:
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def check_brute_force(ip: str, email: str):
    identifier = f"{ip}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": identifier}, {"_id": 0})
    if attempt and attempt.get("count", 0) >= 5:
        lockout_until = attempt.get("lockout_until")
        if lockout_until and now_utc() < as_utc(lockout_until):
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")
        await db.login_attempts.delete_one({"identifier": identifier})


async def record_failed_attempt(ip: str, email: str):
    identifier = f"{ip}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": identifier}, {"_id": 0})
    if attempt:
        new_count = attempt.get("count", 0) + 1
        update_data = {"count": new_count, "last_attempt": now_utc()}
        if new_count >= 5:
            update_data["lockout_until"] = now_utc() + timedelta(minutes=15)
        await db.login_attempts.update_one({"identifier": identifier}, {"$set": update_data})
    else:
        await db.login_attempts.insert_one({"identifier": identifier, "count": 1, "last_attempt": now_utc()})


async def clear_failed_attempts(ip: str, email: str):
    await db.login_attempts.delete_one({"identifier": f"{ip}:{email}"})


# ---------- Auth ----------

class RegisterInput(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: Email
    password: str = Field(min_length=6, max_length=128)


    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Please enter your name")
        return v


class LoginInput(BaseModel):
    email: str
    password: str


class ProfileInput(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)


class ForgotPasswordInput(BaseModel):
    email: str


class ResetPasswordInput(BaseModel):
    token: str
    password: str = Field(min_length=6, max_length=128)


@api_router.post("/auth/register")
async def register(input_data: RegisterInput, response: Response):
    if await db.users.find_one({"email": input_data.email}):
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    user_doc = {"email": input_data.email, "password_hash": hash_password(input_data.password), "name": input_data.name, "role": "user", "created_at": now_iso()}
    result = await db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id
    set_auth_cookies(response, str(result.inserted_id), input_data.email)
    return public_user(user_doc)


@api_router.post("/auth/login")
async def login(input_data: LoginInput, request: Request, response: Response):
    email = input_data.email.lower().strip()
    ip = request.client.host
    await check_brute_force(ip, email)
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(input_data.password, user["password_hash"]):
        await record_failed_attempt(ip, email)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await clear_failed_attempts(ip, email)
    set_auth_cookies(response, str(user["_id"]), email)
    return public_user(user)


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out successfully"}


@api_router.get("/auth/me")
async def get_me(request: Request):
    return public_user(await get_current_user(request))


@api_router.get("/auth/session")
async def get_session(request: Request, response: Response):
    """Current user or null (never 401), renewing an expired access token from the refresh cookie."""
    user = await get_optional_user(request)
    if not user:
        token = request.cookies.get("refresh_token")
        try:
            payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM]) if token else None
            if payload and payload.get("type") == "refresh":
                user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
                if user:
                    response.set_cookie(key="access_token", value=create_access_token(str(user["_id"]), user["email"]), httponly=True, secure=False, samesite="lax", max_age=900, path="/")
        except (jwt.InvalidTokenError, ValueError):
            user = None
    return {"user": public_user(user) if user else None}


@api_router.patch("/auth/me")
async def update_me(input_data: ProfileInput, request: Request):
    user = await get_current_user(request)
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"name": input_data.name.strip()}})
    user["name"] = input_data.name.strip()
    return public_user(user)


@api_router.post("/auth/change-password")
async def change_password(input_data: ChangePasswordInput, request: Request):
    user = await get_current_user(request)
    if not verify_password(input_data.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"password_hash": hash_password(input_data.new_password)}})
    return {"message": "Password updated"}


@api_router.post("/auth/refresh")
async def refresh_token_endpoint(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token provided")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        response.set_cookie(key="access_token", value=create_access_token(str(user["_id"]), user["email"]), httponly=True, secure=False, samesite="lax", max_age=900, path="/")
        return {"message": "Token refreshed"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


@api_router.post("/auth/forgot-password")
async def forgot_password(input_data: ForgotPasswordInput):
    email = input_data.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "token": token, "user_id": str(user["_id"]), "email": email,
            "expires_at": now_utc() + timedelta(hours=1), "used": False
        })
        logger.info(f"Password reset link: /reset-password?token={token}")
    return {"message": "If that email exists, a reset link has been sent."}


@api_router.post("/auth/reset-password")
async def reset_password(input_data: ResetPasswordInput):
    reset_doc = await db.password_reset_tokens.find_one({"token": input_data.token, "used": False}, {"_id": 0})
    if not reset_doc or now_utc() > as_utc(reset_doc["expires_at"]):
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    await db.users.update_one({"email": reset_doc["email"]}, {"$set": {"password_hash": hash_password(input_data.password)}})
    await db.password_reset_tokens.update_one({"token": input_data.token}, {"$set": {"used": True}})
    return {"message": "Password has been reset successfully"}


# ---------- Newsletter & contact ----------

class NewsletterInput(BaseModel):
    email: Email


class ContactInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: Email
    message: str = Field(min_length=1, max_length=5000)


@api_router.post("/newsletter")
async def subscribe_newsletter(input_data: NewsletterInput):
    if await db.newsletter.find_one({"email": input_data.email}):
        return {"message": "You're already subscribed!"}
    await db.newsletter.insert_one({"email": input_data.email, "subscribed_at": now_iso()})
    return {"message": "Successfully subscribed to our newsletter!"}


@api_router.post("/contact")
async def submit_contact(input_data: ContactInput):
    await db.contacts.insert_one({
        "id": uuid.uuid4().hex, "name": input_data.name.strip(), "email": input_data.email,
        "message": input_data.message.strip(), "read": False, "submitted_at": now_iso(),
    })
    return {"message": "Thank you for your message. We'll get back to you soon!"}


# ---------- Store settings ----------

DEFAULT_SETTINGS = {
    "announcement_enabled": True,
    "announcement_text": "Free shipping on orders above ₹999 · Free gift wrapping on every order",
    "shipping_fee": 79.0,
    "free_shipping_threshold": 999.0,
    "store_email": "hello@aurevia.in",
    "store_phone": "+91 98765 43210",
    "store_address": "Shop 12, Linking Road, Bandra West, Mumbai 400050",
    "instagram_url": "",
    "facebook_url": "",
    "twitter_url": "",
}


class SettingsInput(BaseModel):
    announcement_enabled: bool
    announcement_text: str = Field(default="", max_length=200)
    shipping_fee: float = Field(ge=0, le=100000)
    free_shipping_threshold: float = Field(ge=0, le=10000000)
    store_email: str = Field(default="", max_length=120)
    store_phone: str = Field(default="", max_length=40)
    store_address: str = Field(default="", max_length=200)
    instagram_url: str = Field(default="", max_length=300)
    facebook_url: str = Field(default="", max_length=300)
    twitter_url: str = Field(default="", max_length=300)

    @field_validator("instagram_url", "facebook_url", "twitter_url")
    @classmethod
    def check_url(cls, v: str) -> str:
        v = v.strip()
        if v and not re.match(r"^https?://", v, re.I):
            raise ValueError("Social links must start with http:// or https://")
        return v


async def get_settings() -> dict:
    doc = await db.settings.find_one({"_id": "store"}, {"_id": 0}) or {}
    return {**DEFAULT_SETTINGS, **doc}


def shipping_for(subtotal: float, settings: dict) -> float:
    threshold = settings["free_shipping_threshold"]
    if settings["shipping_fee"] <= 0 or (threshold > 0 and subtotal >= threshold):
        return 0.0
    return round(settings["shipping_fee"], 2)


@api_router.get("/settings")
async def read_settings():
    return await get_settings()


@api_router.put("/admin/settings")
async def update_settings(input_data: SettingsInput, admin: dict = Depends(require_admin)):
    data = input_data.model_dump()
    data["announcement_text"] = data["announcement_text"].strip()
    await db.settings.update_one({"_id": "store"}, {"$set": data}, upsert=True)
    logger.info(f"Store settings updated by {admin['email']}")
    return await get_settings()


# ---------- Products ----------

class ProductInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    price: float = Field(gt=0)
    compare_at_price: Optional[float] = Field(default=None, ge=0)
    category: str = Field(min_length=1, max_length=40)
    description: str = Field(default="", max_length=2000)
    images: List[str] = Field(default_factory=list)
    materials: List[str] = Field(default_factory=list)
    sizes: List[str] = Field(default_factory=list)
    bestseller: bool = False
    active: bool = True
    stock: int = Field(default=0, ge=0)
    recipients: List[Literal["her", "him", "couples"]] = Field(default_factory=lambda: ["her"])


PUBLIC_PRODUCTS = {"active": {"$ne": False}}


def clean_list(values: List[str]) -> List[str]:
    seen, out = set(), []
    for v in values:
        v = v.strip()
        if v and v not in seen:
            seen.add(v)
            out.append(v)
    return out


def normalize_product(data: ProductInput) -> dict:
    doc = data.model_dump()
    doc["name"] = doc["name"].strip()
    doc["category"] = doc["category"].strip()
    doc["description"] = doc["description"].strip()
    doc["price"] = round(doc["price"], 2)
    # A "compare at" price only makes sense when it is higher than the selling price.
    cap = doc["compare_at_price"]
    doc["compare_at_price"] = round(cap, 2) if cap and cap > doc["price"] else None
    for key in ("images", "materials", "sizes"):
        doc[key] = clean_list(doc[key])
    if not doc["images"]:
        raise HTTPException(status_code=422, detail="At least one image is required")
    # The storefront needs at least one option to add an item to the cart.
    doc["materials"] = doc["materials"] or ["Standard"]
    doc["sizes"] = doc["sizes"] or ["One Size"]
    doc["recipients"] = list(dict.fromkeys(doc["recipients"])) or ["her"]
    return doc


async def ensure_category(name: str):
    if not await db.categories.find_one({"name": name}, {"_id": 1}):
        raise HTTPException(status_code=422, detail=f"Category '{name}' doesn't exist. Create it under Categories first.")


async def make_product_id(category: str, name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", f"{category.rstrip('s')}-{name}".lower()).strip("-") or "product"
    candidate, n = base, 2
    while await db.products.find_one({"id": candidate}, {"_id": 1}):
        candidate, n = f"{base}-{n}", n + 1
    return candidate


@api_router.get("/products")
async def list_products(category: Optional[str] = None):
    query = {**PUBLIC_PRODUCTS, **({"category": category} if category else {})}
    return await db.products.find(query, {"_id": 0}).sort("created_at", 1).to_list(1000)


@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id, **PUBLIC_PRODUCTS}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@api_router.get("/admin/products")
async def admin_list_products(admin: dict = Depends(require_admin)):
    return await db.products.find({}, {"_id": 0}).sort("created_at", 1).to_list(5000)


@api_router.post("/admin/products", status_code=201)
async def create_product(input_data: ProductInput, admin: dict = Depends(require_admin)):
    doc = normalize_product(input_data)
    await ensure_category(doc["category"])
    ts = now_iso()
    doc.update({"id": await make_product_id(doc["category"], doc["name"]), "created_at": ts, "updated_at": ts})
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    logger.info(f"Product created by {admin['email']}: {doc['id']}")
    return doc


@api_router.put("/admin/products/{product_id}")
async def update_product(product_id: str, input_data: ProductInput, admin: dict = Depends(require_admin)):
    doc = normalize_product(input_data)
    await ensure_category(doc["category"])
    doc["updated_at"] = now_iso()
    result = await db.products.update_one({"id": product_id}, {"$set": doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    logger.info(f"Product updated by {admin['email']}: {product_id}")
    return await db.products.find_one({"id": product_id}, {"_id": 0})


@api_router.delete("/admin/products/{product_id}")
async def delete_product(product_id: str, admin: dict = Depends(require_admin)):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.products.delete_one({"id": product_id})
    # Remove uploaded image files no other product (or past order) still uses.
    for url in product.get("images", []):
        if url.startswith("/uploads/") \
                and not await db.products.find_one({"images": url}, {"_id": 1}) \
                and not await db.orders.find_one({"items.image": url}, {"_id": 1}):
            (UPLOAD_DIR / Path(url).name).unlink(missing_ok=True)
    logger.info(f"Product deleted by {admin['email']}: {product_id}")
    return {"message": f"Deleted {product['name']}"}


ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024


@api_router.post("/admin/upload")
async def upload_image(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    ext = ALLOWED_IMAGE_TYPES.get(file.content_type)
    if not ext:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP or GIF images are allowed")
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Image must be 5 MB or smaller")
    filename = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / filename).write_bytes(content)
    return {"url": f"/uploads/{filename}"}


# ---------- Storefront content: categories, hero slides, offers ----------

def check_link(v: str) -> str:
    v = v.strip()
    if v and not (v.startswith("/") or re.match(r"^https?://", v, re.I)):
        raise ValueError("Links must start with / (a page on this site) or http(s)://")
    return v


Link = Annotated[str, AfterValidator(check_link)]


class CategoryInput(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    image: str = Field(min_length=1, max_length=1000)
    active: bool = True


class SlideInput(BaseModel):
    image: str = Field(min_length=1, max_length=1000)
    title: str = Field(default="", max_length=80)
    subtitle: str = Field(default="", max_length=160)
    cta_text: str = Field(default="", max_length=30)
    cta_link: Link = Field(default="", max_length=300)
    active: bool = True


class OfferInput(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=200)
    code: str = Field(default="", max_length=30)
    discount_type: Literal["none", "percent", "flat"] = "none"
    discount_value: float = Field(default=0, ge=0)
    min_order: float = Field(default=0, ge=0)
    image: str = Field(default="", max_length=1000)
    cta_text: str = Field(default="", max_length=30)
    cta_link: Link = Field(default="", max_length=300)
    show_popup: bool = False
    show_banner: bool = True
    active: bool = True

    @field_validator("code")
    @classmethod
    def clean_code(cls, v: str) -> str:
        v = v.strip().upper()
        if v and not re.match(r"^[A-Z0-9_-]{3,30}$", v):
            raise ValueError("Coupon codes use 3-30 letters, numbers, - or _")
        return v


class ReorderInput(BaseModel):
    ids: List[str] = Field(min_length=1, max_length=500)


def validate_offer(doc: dict) -> dict:
    if doc["code"] and (doc["discount_type"] == "none" or doc["discount_value"] <= 0):
        raise HTTPException(status_code=422, detail="A coupon code needs a discount (percentage or flat amount).")
    if doc["discount_type"] == "percent" and doc["discount_value"] > 90:
        raise HTTPException(status_code=422, detail="Percentage discounts can be at most 90%.")
    if not doc["code"]:
        doc.update({"discount_type": "none", "discount_value": 0, "min_order": 0})
    return doc


CONTENT = {
    "categories": {"model": CategoryInput, "label": "Category"},
    "slides": {"model": SlideInput, "label": "Slide"},
    "offers": {"model": OfferInput, "label": "Offer"},
}


async def list_content(kind: str, only_active: bool = False) -> List[dict]:
    return await db[kind].find({"active": True} if only_active else {}, {"_id": 0}).sort("position", 1).to_list(500)


async def prepare_content(kind: str, data: BaseModel, current: Optional[dict] = None) -> dict:
    doc = data.model_dump()
    for k, v in doc.items():
        if isinstance(v, str):
            doc[k] = v.strip()
    others = [x for x in await db[kind].find({}, {"_id": 0}).to_list(500) if not current or x["id"] != current["id"]]
    if kind == "categories" and any(x["name"].lower() == doc["name"].lower() for x in others):
        raise HTTPException(status_code=409, detail=f"A category called '{doc['name']}' already exists.")
    if kind == "offers":
        validate_offer(doc)
        if doc["code"] and any(x.get("code") == doc["code"] for x in others):
            raise HTTPException(status_code=409, detail=f"Coupon code {doc['code']} is already used by another offer.")
    return doc


def register_content_routes(kind: str):
    label, Model = CONTENT[kind]["label"], CONTENT[kind]["model"]

    async def _list(admin: dict = Depends(require_admin)):
        items = await list_content(kind)
        if kind == "categories":
            for c in items:
                c["product_count"] = await db.products.count_documents({"category": c["name"]})
        return items

    async def _create(input_data: Model, admin: dict = Depends(require_admin)):
        doc = await prepare_content(kind, input_data)
        last = await db[kind].find({}, {"_id": 0, "position": 1}).sort("position", -1).to_list(1)
        doc.update({"id": uuid.uuid4().hex, "position": (last[0]["position"] + 1) if last else 0, "created_at": now_iso()})
        await db[kind].insert_one(doc)
        doc.pop("_id", None)
        return doc

    async def _update(item_id: str, input_data: Model, admin: dict = Depends(require_admin)):
        current = await db[kind].find_one({"id": item_id}, {"_id": 0})
        if not current:
            raise HTTPException(status_code=404, detail=f"{label} not found")
        doc = await prepare_content(kind, input_data, current)
        await db[kind].update_one({"id": item_id}, {"$set": doc})
        if kind == "categories" and doc["name"] != current["name"]:
            # Products reference categories by name; carry them over to the new name.
            await db.products.update_many({"category": current["name"]}, {"$set": {"category": doc["name"]}})
        return await db[kind].find_one({"id": item_id}, {"_id": 0})

    async def _delete(item_id: str, admin: dict = Depends(require_admin)):
        current = await db[kind].find_one({"id": item_id}, {"_id": 0})
        if not current:
            raise HTTPException(status_code=404, detail=f"{label} not found")
        if kind == "categories":
            used = await db.products.count_documents({"category": current["name"]})
            if used:
                raise HTTPException(status_code=409, detail=f"{used} product(s) are in '{current['name']}'. Move or delete them first, or hide the category instead.")
        await db[kind].delete_one({"id": item_id})
        return {"message": f"{label} deleted"}

    async def _reorder(input_data: ReorderInput, admin: dict = Depends(require_admin)):
        for i, item_id in enumerate(input_data.ids):
            await db[kind].update_one({"id": item_id}, {"$set": {"position": i}})
        return await list_content(kind)

    # Reorder is registered before /{item_id} so "reorder" isn't treated as an id.
    api_router.add_api_route(f"/admin/{kind}", _list, methods=["GET"], name=f"list_{kind}")
    api_router.add_api_route(f"/admin/{kind}", _create, methods=["POST"], status_code=201, name=f"create_{kind}")
    api_router.add_api_route(f"/admin/{kind}/reorder", _reorder, methods=["POST"], name=f"reorder_{kind}")
    api_router.add_api_route(f"/admin/{kind}/{{item_id}}", _update, methods=["PUT"], name=f"update_{kind}")
    api_router.add_api_route(f"/admin/{kind}/{{item_id}}", _delete, methods=["DELETE"], name=f"delete_{kind}")


for _kind in CONTENT:
    register_content_routes(_kind)


@api_router.get("/storefront")
async def storefront():
    categories = await list_content("categories", only_active=True)
    for c in categories:
        c["product_count"] = await db.products.count_documents({"category": c["name"], **PUBLIC_PRODUCTS})
    return {
        "slides": await list_content("slides", only_active=True),
        "categories": categories,
        "offers": await list_content("offers", only_active=True),
    }


# ---------- Coupons ----------

class CouponInput(BaseModel):
    code: str = Field(min_length=1, max_length=30)
    subtotal: float = Field(ge=0)


async def find_coupon(code: str) -> dict:
    offer = await db.offers.find_one({"code": code.strip().upper(), "active": True}, {"_id": 0})
    if not offer:
        raise HTTPException(status_code=400, detail="This coupon code isn't valid or has expired.")
    return offer


def coupon_discount(offer: dict, subtotal: float) -> float:
    if subtotal < offer.get("min_order", 0):
        short = offer["min_order"] - subtotal
        raise HTTPException(status_code=400, detail=f"Add ₹{short:,.0f} more to use {offer['code']} (minimum order ₹{offer['min_order']:,.0f}).")
    if offer["discount_type"] == "percent":
        return round(subtotal * offer["discount_value"] / 100, 2)
    return round(min(offer["discount_value"], subtotal), 2)


@api_router.post("/coupons/validate")
async def validate_coupon(input_data: CouponInput):
    offer = await find_coupon(input_data.code)
    discount = coupon_discount(offer, input_data.subtotal)
    return {"code": offer["code"], "title": offer["title"], "discount": discount,
            "discount_type": offer["discount_type"], "discount_value": offer["discount_value"], "min_order": offer["min_order"]}


# ---------- Orders ----------

ORDER_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"]
PAYMENT_STATUSES = ["unpaid", "paid", "refunded"]


class OrderItemInput(BaseModel):
    product_id: str
    size: str
    material: str
    quantity: int = Field(ge=1, le=50)


class CustomerInput(BaseModel):
    first_name: str = Field(min_length=1, max_length=60)
    last_name: str = Field(min_length=1, max_length=60)
    email: Email
    phone: str = Field(default="", max_length=30)
    address: str = Field(min_length=1, max_length=200)
    city: str = Field(min_length=1, max_length=80)
    state: str = Field(default="", max_length=60)
    zip: str = Field(min_length=1, max_length=20)
    country: str = Field(default="India", min_length=1, max_length=60)


class OrderInput(BaseModel):
    items: List[OrderItemInput] = Field(min_length=1, max_length=50)
    customer: CustomerInput
    notes: str = Field(default="", max_length=500)
    payment_method: Literal["cod"] = "cod"
    coupon_code: str = Field(default="", max_length=30)


class OrderUpdateInput(BaseModel):
    status: Optional[Literal["pending", "processing", "shipped", "delivered", "cancelled"]] = None
    payment_status: Optional[Literal["unpaid", "paid", "refunded"]] = None
    tracking_number: Optional[str] = Field(default=None, max_length=80)


async def make_order_number() -> str:
    while True:
        number = f"AUR-{now_utc():%y%m%d}-{secrets.token_hex(2).upper()}"
        if not await db.orders.find_one({"number": number}, {"_id": 1}):
            return number


async def restock(items: List[dict]):
    for item in items:
        await db.products.update_one({"id": item["product_id"]}, {"$inc": {"stock": item["quantity"]}})


@api_router.post("/orders", status_code=201)
async def place_order(input_data: OrderInput, request: Request):
    user = await get_optional_user(request)

    # Merge duplicate lines (same product + options).
    merged = {}
    for it in input_data.items:
        key = (it.product_id, it.size, it.material)
        merged[key] = merged.get(key, 0) + it.quantity

    lines = []
    for (product_id, size, material), qty in merged.items():
        product = await db.products.find_one({"id": product_id, **PUBLIC_PRODUCTS}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=409, detail="An item in your cart is no longer available. Please review your cart.")
        if size not in product["sizes"] or material not in product["materials"]:
            raise HTTPException(status_code=409, detail=f"The selected options for {product['name']} are no longer available.")
        lines.append((product, size, material, qty))

    # Reserve stock atomically; roll back everything if any line can't be fulfilled.
    reserved = []
    for product, size, material, qty in lines:
        result = await db.products.update_one({"id": product["id"], "stock": {"$gte": qty}}, {"$inc": {"stock": -qty}})
        if result.modified_count == 0:
            await restock(reserved)
            fresh = await db.products.find_one({"id": product["id"]}, {"_id": 0, "stock": 1}) or {}
            left = fresh.get("stock", 0)
            msg = f"{product['name']} is sold out." if left == 0 else f"Only {left} of {product['name']} left in stock."
            raise HTTPException(status_code=409, detail=msg)
        reserved.append({"product_id": product["id"], "quantity": qty})

    items = [{
        "product_id": p["id"], "name": p["name"], "image": p["images"][0], "price": p["price"],
        "size": size, "material": material, "quantity": qty, "line_total": round(p["price"] * qty, 2),
    } for p, size, material, qty in lines]
    subtotal = round(sum(i["line_total"] for i in items), 2)
    settings = await get_settings()
    shipping = shipping_for(subtotal, settings)
    discount, coupon = 0.0, None
    if input_data.coupon_code.strip():
        try:
            offer = await find_coupon(input_data.coupon_code)
            discount = coupon_discount(offer, subtotal)
            coupon = {"code": offer["code"], "title": offer["title"]}
        except HTTPException:
            await restock(reserved)
            raise
    ts = now_iso()
    order = {
        "id": uuid.uuid4().hex,
        "number": await make_order_number(),
        "user_id": str(user["_id"]) if user else None,
        "customer": input_data.customer.model_dump(),
        "items": items,
        "subtotal": subtotal,
        "discount": discount,
        "coupon": coupon,
        "shipping": shipping,
        "total": round(subtotal - discount + shipping, 2),
        "notes": input_data.notes.strip(),
        "payment_method": input_data.payment_method,
        "payment_status": "unpaid",
        "status": "pending",
        "tracking_number": "",
        "history": [{"status": "pending", "at": ts}],
        "created_at": ts,
        "updated_at": ts,
    }
    await db.orders.insert_one(order)
    order.pop("_id", None)
    logger.info(f"Order {order['number']} placed ({order['total']})")
    return order


@api_router.get("/orders/mine")
async def my_orders(request: Request):
    user = await get_current_user(request)
    query = {"$or": [{"user_id": str(user["_id"])}, {"customer.email": user["email"]}]}
    return await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)


class TrackInput(BaseModel):
    number: str = Field(min_length=1, max_length=40)
    email: str = Field(min_length=3, max_length=200)


# POST so the customer's email isn't written to URLs / access logs.
@api_router.post("/orders/track")
async def track_order(input_data: TrackInput):
    order = await db.orders.find_one({"number": input_data.number.strip().upper(), "customer.email": input_data.email.strip().lower()}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="No order found with that number and email")
    return order


@api_router.post("/orders/{order_id}/cancel")
async def cancel_my_order(order_id: str, request: Request):
    user = await get_current_user(request)
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order or (order.get("user_id") != str(user["_id"]) and order["customer"]["email"] != user["email"]):
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] != "pending":
        raise HTTPException(status_code=400, detail="Only pending orders can be cancelled. Please contact us for help.")
    ts = now_iso()
    await restock(order["items"])
    await db.orders.update_one({"id": order_id}, {"$set": {"status": "cancelled", "updated_at": ts}, "$push": {"history": {"status": "cancelled", "at": ts, "by": "customer"}}})
    return await db.orders.find_one({"id": order_id}, {"_id": 0})


@api_router.get("/admin/orders")
async def admin_orders(admin: dict = Depends(require_admin)):
    return await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)


@api_router.patch("/admin/orders/{order_id}")
async def admin_update_order(order_id: str, input_data: OrderUpdateInput, admin: dict = Depends(require_admin)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    ts = now_iso()
    changes, push = {"updated_at": ts}, None
    new_status = input_data.status
    if new_status and new_status != order["status"]:
        if order["status"] == "cancelled":
            raise HTTPException(status_code=400, detail="Cancelled orders can't be reopened. Ask the customer to place a new order.")
        if new_status == "cancelled":
            await restock(order["items"])
        changes["status"] = new_status
        push = {"status": new_status, "at": ts, "by": admin["email"]}
        # Cash on delivery is collected when the parcel is delivered.
        if new_status == "delivered" and order["payment_method"] == "cod" and order["payment_status"] == "unpaid" and not input_data.payment_status:
            changes["payment_status"] = "paid"
    if input_data.payment_status:
        changes["payment_status"] = input_data.payment_status
    if input_data.tracking_number is not None:
        changes["tracking_number"] = input_data.tracking_number.strip()
    update = {"$set": changes}
    if push:
        update["$push"] = {"history": push}
    await db.orders.update_one({"id": order_id}, update)
    return await db.orders.find_one({"id": order_id}, {"_id": 0})


# ---------- Admin: dashboard, customers, messages, subscribers ----------

@api_router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(require_admin)):
    products = await db.products.find({}, {"_id": 0, "id": 1, "name": 1, "price": 1, "stock": 1, "images": 1, "active": 1}).to_list(5000)
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    valid = [o for o in orders if o["status"] != "cancelled"]
    revenue = round(sum(o["total"] for o in valid), 2)

    today = now_utc().date()
    days = [(today - timedelta(days=i)).isoformat() for i in range(13, -1, -1)]
    by_day = {d: {"date": d, "revenue": 0.0, "orders": 0} for d in days}
    for o in valid:
        d = o["created_at"][:10]
        if d in by_day:
            by_day[d]["revenue"] = round(by_day[d]["revenue"] + o["total"], 2)
            by_day[d]["orders"] += 1

    sold = {}
    for o in valid:
        for it in o["items"]:
            entry = sold.setdefault(it["product_id"], {"product_id": it["product_id"], "name": it["name"], "image": it["image"], "units": 0, "revenue": 0.0})
            entry["units"] += it["quantity"]
            entry["revenue"] = round(entry["revenue"] + it["line_total"], 2)

    low = sorted([p for p in products if p.get("stock", 0) <= 5], key=lambda p: p.get("stock", 0))
    return {
        "revenue": revenue,
        "orders": len(orders),
        "open_orders": sum(1 for o in orders if o["status"] in ("pending", "processing")),
        "pending_orders": sum(1 for o in orders if o["status"] == "pending"),
        "avg_order_value": round(revenue / len(valid), 2) if valid else 0,
        "products": len(products),
        "hidden_products": sum(1 for p in products if p.get("active") is False),
        "out_of_stock": sum(1 for p in products if p.get("stock", 0) == 0),
        "low_stock": sum(1 for p in products if 0 < p.get("stock", 0) <= 5),
        "inventory_value": round(sum(p["price"] * p.get("stock", 0) for p in products), 2),
        "users": await db.users.count_documents({"role": "user"}),
        "subscribers": await db.newsletter.count_documents({}),
        "messages": await db.contacts.count_documents({}),
        "unread_messages": await db.contacts.count_documents({"read": False}),
        "sales_by_day": list(by_day.values()),
        "recent_orders": orders[:6],
        "top_products": sorted(sold.values(), key=lambda s: s["units"], reverse=True)[:5],
        "low_stock_products": low[:6],
        "memory_db": USING_MEMORY_DB,
    }


@api_router.get("/admin/customers")
async def admin_customers(admin: dict = Depends(require_admin)):
    users = await db.users.find({"role": "user"}, {"_id": 1, "email": 1, "name": 1, "created_at": 1}).sort("created_at", -1).to_list(10000)
    orders = await db.orders.find({}, {"_id": 0, "customer.email": 1, "total": 1, "status": 1, "created_at": 1}).to_list(10000)
    stats = {}
    for o in orders:
        s = stats.setdefault(o["customer"]["email"], {"orders": 0, "spent": 0.0, "last_order": None})
        s["orders"] += 1
        if o["status"] != "cancelled":
            s["spent"] = round(s["spent"] + o["total"], 2)
        s["last_order"] = max(filter(None, [s["last_order"], o["created_at"]]))
    return [{
        "id": str(u["_id"]), "name": u.get("name", ""), "email": u["email"], "created_at": u.get("created_at"),
        **stats.get(u["email"], {"orders": 0, "spent": 0.0, "last_order": None}),
    } for u in users]


class MessageUpdateInput(BaseModel):
    read: bool


@api_router.get("/admin/messages")
async def admin_messages(admin: dict = Depends(require_admin)):
    return await db.contacts.find({}, {"_id": 0}).sort("submitted_at", -1).to_list(1000)


@api_router.patch("/admin/messages/{message_id}")
async def admin_update_message(message_id: str, input_data: MessageUpdateInput, admin: dict = Depends(require_admin)):
    result = await db.contacts.update_one({"id": message_id}, {"$set": {"read": input_data.read}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"message": "Updated"}


@api_router.delete("/admin/messages/{message_id}")
async def admin_delete_message(message_id: str, admin: dict = Depends(require_admin)):
    result = await db.contacts.delete_one({"id": message_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"message": "Message deleted"}


@api_router.get("/admin/subscribers")
async def admin_subscribers(admin: dict = Depends(require_admin)):
    return await db.newsletter.find({}, {"_id": 0}).sort("subscribed_at", -1).to_list(10000)


@api_router.delete("/admin/subscribers/{email}")
async def admin_delete_subscriber(email: str, admin: dict = Depends(require_admin)):
    result = await db.newsletter.delete_one({"email": email.lower()})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    return {"message": f"Removed {email}"}


@api_router.get("/")
async def root():
    return {"message": "Aurevia API"}


app.include_router(api_router)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000"), os.environ.get("ADMIN_URL", "http://localhost:3001")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Startup ----------

async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@aurevia.com").lower()
    env_password = os.environ.get("ADMIN_PASSWORD")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({"email": admin_email, "password_hash": hash_password(env_password or "Admin@123"), "name": "Admin", "role": "admin", "created_at": now_iso()})
        logger.info(f"Admin user created: {admin_email}")
    elif env_password and not verify_password(env_password, existing["password_hash"]):
        # Only enforce the password when it is explicitly configured, so a password
        # changed from the admin panel isn't reverted on every restart.
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(env_password), "role": "admin"}})
        logger.info(f"Admin password reset from ADMIN_PASSWORD: {admin_email}")


async def seed_products():
    if await db.products.count_documents({}) > 0:
        return
    seed = json.loads((ROOT_DIR / "seed_products.json").read_text(encoding="utf-8"))
    base = now_utc()
    for i, p in enumerate(seed):
        # Distinct timestamps keep the original catalog order (listing sorts by created_at).
        ts = (base + timedelta(milliseconds=i)).isoformat()
        p.update({"created_at": ts, "updated_at": ts, "active": True})
        p.setdefault("compare_at_price", None)
    await db.products.insert_many(seed)
    logger.info(f"Seeded {len(seed)} products")


async def migrate_messages():
    # Older contact messages were stored without an id / read flag.
    async for msg in db.contacts.find({"id": {"$exists": False}}, {"_id": 1}):
        await db.contacts.update_one({"_id": msg["_id"]}, {"$set": {"id": uuid.uuid4().hex, "read": False}})


async def seed_storefront():
    media = json.loads((ROOT_DIR / "seed_media.json").read_text(encoding="utf-8"))
    ts = now_iso()
    if await db.categories.count_documents({}) == 0:
        await db.categories.insert_many([
            {"id": uuid.uuid4().hex, "name": name, "image": image, "active": True, "position": i, "created_at": ts}
            for i, (name, image) in enumerate(media["cats"].items())
        ])
    if await db.slides.count_documents({}) == 0:
        slides = [
            ("Jewellery that says it for you", "Anti-tarnish, skin-friendly pieces from ₹449, gift-wrapped free", "Shop Now", "/shop"),
            ("The Festive Edit", "Kundan, temple & AD sets for weddings, sangeet and celebrations", "Explore Necklaces", "/shop?category=Necklaces"),
            ("Gift boxes, ready to wow", "Curated sets in keepsake boxes with a handwritten note", "Shop Gift Boxes", "/shop?category=Gift%20Boxes"),
            ("Stack. Mix. Shine.", "Everyday rings and bracelets under ₹999", "Shop Bracelets", "/shop?category=Bracelets"),
        ]
        await db.slides.insert_many([
            {"id": uuid.uuid4().hex, "image": media["hero"][i], "title": t, "subtitle": st, "cta_text": c, "cta_link": l, "active": True, "position": i, "created_at": ts}
            for i, (t, st, c, l) in enumerate(slides)
        ])
    if await db.offers.count_documents({}) == 0:
        offers = [
            dict(title="10% off your first order", description="New here? Use code WELCOME10 on orders above ₹499.", code="WELCOME10",
                 discount_type="percent", discount_value=10, min_order=499, image=media["for"]["her"], cta_text="Start Shopping", cta_link="/shop", show_popup=True, show_banner=True),
            dict(title="Flat ₹200 off on gift boxes & more", description="On orders above ₹1,999 with code GIFT200, made for festive gifting.", code="GIFT200",
                 discount_type="flat", discount_value=200, min_order=1999, image="", cta_text="Shop Gift Boxes", cta_link="/shop?category=Gift%20Boxes", show_popup=False, show_banner=True),
            dict(title="Free gift wrapping on every order", description="Every piece arrives in our signature box with a handwritten note card.", code="",
                 discount_type="none", discount_value=0, min_order=0, image="", cta_text="Find a Gift", cta_link="/shop?for=her", show_popup=False, show_banner=True),
        ]
        await db.offers.insert_many([{**o, "id": uuid.uuid4().hex, "active": True, "position": i, "created_at": ts} for i, o in enumerate(offers)])


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier")
    await db.newsletter.create_index("email", unique=True)
    await db.products.create_index("id", unique=True)
    await db.orders.create_index("id", unique=True)
    await db.orders.create_index("number", unique=True)
    await seed_admin()
    await seed_products()
    await seed_storefront()
    await migrate_messages()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
