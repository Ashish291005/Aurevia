"""End-to-end API checks, run in-process against the configured database.

    cd backend
    python tests/test_api.py                 # in-memory DB (default)
    TEST_DATABASE_URL=postgresql://... python tests/test_api.py   # Supabase/Postgres

Uses a throwaway admin and unique emails, and only touches rows it creates (plus restoring
settings it changes), so it is safe to run against a fresh Supabase project before launch.
"""
import hashlib
import hmac
import json
import os
import sys
import uuid
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "")
os.environ.setdefault("MONGO_URL", "")
os.environ.update(JWT_SECRET=os.environ.get("JWT_SECRET", "test-secret"), RAZORPAY_KEY_ID="rzp_test_FAKE",
                  RAZORPAY_KEY_SECRET="fake_secret", RAZORPAY_WEBHOOK_SECRET="whsec_fake",
                  ADMIN_EMAIL=os.environ.get("TEST_ADMIN_EMAIL", "admin@aurevia.com"),
                  ADMIN_PASSWORD=os.environ.get("TEST_ADMIN_PASSWORD", "Admin@123"),
                  SUPABASE_URL="", SUPABASE_SERVICE_ROLE_KEY="")
sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)

import server  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

RUN = uuid.uuid4().hex[:6]
fails = []


def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  -> {extra}"))
    if not cond:
        fails.append(name)


async def fake_rzp_order(total, receipt):
    return {"id": f"order_T{uuid.uuid4().hex[:8]}"}

server.razorpay_create_order = fake_rzp_order
sign = lambda msg, secret: hmac.new(secret.encode(), msg.encode(), hashlib.sha256).hexdigest()  # noqa: E731

with TestClient(server.app) as anon:
    print(f"Database backend: {server.DB_BACKEND}\n")
    admin = TestClient(server.app)
    r = admin.post("/api/auth/login", json={"email": os.environ["ADMIN_EMAIL"], "password": os.environ["ADMIN_PASSWORD"]})
    check("admin login", r.status_code == 200 and r.json()["role"] == "admin", r.text)

    # Catalogue & storefront
    products = anon.get("/api/products").json()
    check("products seeded", len(products) >= 20, len(products))
    sf = anon.get("/api/storefront").json()
    check("storefront content seeded", sf["slides"] and sf["categories"] and sf["offers"])
    check("categories have counts", all("product_count" in c for c in sf["categories"]))

    # Auth
    email = f"buyer-{RUN}@example.test"
    cust = TestClient(server.app)
    check("register validates email", cust.post("/api/auth/register", json={"name": "B", "email": "bad", "password": "Secret#1"}).status_code == 422)
    r = cust.post("/api/auth/register", json={"name": "Buyer", "email": email.upper(), "password": "Secret#1"})
    check("register", r.status_code == 200 and r.json()["email"] == email, r.text)
    check("duplicate email blocked", cust.post("/api/auth/register", json={"name": "B", "email": email, "password": "Secret#1"}).status_code == 400)
    check("session endpoint", cust.get("/api/auth/session").json()["user"]["email"] == email)
    check("guest session is null", anon.get("/api/auth/session").json() == {"user": None})

    # Products CRUD + visibility
    cat = admin.post("/api/admin/categories", json={"name": f"Test Cat {RUN}", "image": "https://example.com/c.jpg"}).json()
    r = admin.post("/api/admin/products", json={"name": f"Test Charm {RUN}", "price": 100, "compare_at_price": 150, "category": cat["name"],
                                                "images": ["https://example.com/a.jpg"], "stock": 3, "recipients": ["her", "him"]})
    check("create product", r.status_code == 201, r.text)
    prod = r.json()
    pid = prod["id"]
    check("unknown category rejected", admin.post("/api/admin/products", json={"name": "X", "price": 1, "category": "Nope", "images": ["u"]}).status_code == 422)
    check("category delete blocked while used", admin.delete(f"/api/admin/categories/{cat['id']}").status_code == 409)
    fields = {k: prod[k] for k in ("name", "price", "compare_at_price", "category", "description", "images", "materials", "sizes", "bestseller", "stock", "recipients")}
    admin.put(f"/api/admin/products/{pid}", json={**fields, "active": False})
    check("hidden product is 404 publicly", anon.get(f"/api/products/{pid}").status_code == 404)
    admin.put(f"/api/admin/products/{pid}", json={**fields, "active": True})
    check("visible again", anon.get(f"/api/products/{pid}").status_code == 200)

    # Orders: stock reservation, coupons, shipping
    customer = {"first_name": "Asha", "last_name": "K", "email": email, "phone": "9876543210", "address": "1 MG Road", "city": "Pune", "state": "Maharashtra", "zip": "411001"}
    item = lambda q: {"product_id": pid, "size": "One Size", "material": "Standard", "quantity": q}  # noqa: E731
    r = cust.post("/api/orders", json={"customer": customer, "items": [item(2)]})
    o1 = r.json()
    check("order placed", r.status_code == 201 and o1["number"].startswith("AUR-"), r.text)
    check("server-side totals + shipping", o1["subtotal"] == 200 and o1["shipping"] == 79 and o1["total"] == 279, o1)
    check("stock decremented atomically", anon.get(f"/api/products/{pid}").json()["stock"] == 1)
    r = cust.post("/api/orders", json={"customer": customer, "items": [item(2)]})
    check("oversell blocked", r.status_code == 409 and "left" in r.json()["detail"], r.text)
    check("stock unchanged after failed order", anon.get(f"/api/products/{pid}").json()["stock"] == 1)
    coupon = admin.post("/api/admin/offers", json={"title": "T", "code": f"T{RUN}", "discount_type": "percent", "discount_value": 10, "min_order": 50}).json()
    r = anon.post("/api/coupons/validate", json={"code": f"t{RUN}", "subtotal": 100})
    check("coupon validates", r.status_code == 200 and r.json()["discount"] == 10, r.text)
    check("coupon min order", anon.post("/api/coupons/validate", json={"code": f"T{RUN}", "subtotal": 10}).status_code == 400)
    r = cust.post("/api/orders", json={"customer": customer, "items": [item(1)], "coupon_code": f"T{RUN}"})
    o2 = r.json()
    check("order with coupon", r.status_code == 201 and o2["discount"] == 10 and o2["total"] == 100 - 10 + 79, r.text)
    check("sold out now", anon.get(f"/api/products/{pid}").json()["stock"] == 0)
    mine = cust.get("/api/orders/mine").json()
    check("my orders", {o1["id"], o2["id"]} <= {o["id"] for o in mine})
    check("track order", anon.post("/api/orders/track", json={"number": o1["number"].lower(), "email": email}).status_code == 200)
    r = cust.post(f"/api/orders/{o2['id']}/cancel")
    check("customer cancel restocks", r.json()["status"] == "cancelled" and anon.get(f"/api/products/{pid}").json()["stock"] == 1, r.text)
    r = admin.patch(f"/api/admin/orders/{o1['id']}", json={"status": "shipped", "tracking_number": "TRK1"})
    check("admin ships order", r.json()["status"] == "shipped" and r.json()["tracking_number"] == "TRK1", r.text)
    r = admin.patch(f"/api/admin/orders/{o1['id']}", json={"status": "delivered"})
    check("COD delivered -> paid, history appended", r.json()["payment_status"] == "paid" and len(r.json()["history"]) == 3, r.text)
    check("cancelled order is final", admin.patch(f"/api/admin/orders/{o2['id']}", json={"status": "processing"}).status_code == 400)

    # Razorpay (provider call stubbed)
    admin.put(f"/api/admin/products/{pid}", json={**fields, "stock": 5, "active": True})
    o3 = cust.post("/api/orders", json={"customer": customer, "items": [item(1)], "payment_method": "razorpay"}).json()
    check("razorpay order", o3.get("razorpay", {}).get("amount") == round(o3["total"] * 100), o3)
    bad = anon.post(f"/api/orders/{o3['id']}/verify-payment", json={"razorpay_order_id": o3["razorpay_order_id"], "razorpay_payment_id": "pay_x", "razorpay_signature": "forged"})
    check("forged payment rejected", bad.status_code == 400)
    good = anon.post(f"/api/orders/{o3['id']}/verify-payment", json={"razorpay_order_id": o3["razorpay_order_id"], "razorpay_payment_id": "pay_x",
                                                                       "razorpay_signature": sign(f"{o3['razorpay_order_id']}|pay_x", "fake_secret")})
    check("verified payment marks paid", good.status_code == 200 and good.json()["payment_status"] == "paid", good.text)
    o4 = cust.post("/api/orders", json={"customer": customer, "items": [item(1)], "payment_method": "razorpay"}).json()
    check("unpaid online order can't ship", admin.patch(f"/api/admin/orders/{o4['id']}", json={"status": "shipped"}).status_code == 400)
    check("dismissed payment cancels", anon.post(f"/api/orders/{o4['id']}/payment-cancelled").json()["status"] == "cancelled")
    evt = json.dumps({"event": "payment.captured", "payload": {"payment": {"entity": {"id": "pay_w", "order_id": "nope"}}}})
    check("webhook signature enforced", anon.post("/api/payments/razorpay/webhook", content=evt, headers={"X-Razorpay-Signature": "x"}).status_code == 400)

    # Reviews
    r = cust.post(f"/api/products/{pid}/reviews", json={"rating": 5, "body": "Lovely piece"})
    check("verified buyer review", r.status_code == 201 and r.json()["verified"] is True, r.text)
    cust.post(f"/api/products/{pid}/reviews", json={"rating": 3, "body": "Edited my review"})
    p = anon.get(f"/api/products/{pid}").json()
    check("one review per user, rating updates", p["rating_count"] == 1 and p["rating_avg"] == 3, p)

    # Content, messages, subscribers, stats, settings
    check("slide rejects unsafe link", admin.post("/api/admin/slides", json={"image": "x", "cta_link": "javascript:alert(1)"}).status_code == 422)
    anon.post("/api/contact", json={"name": "Q", "email": f"q-{RUN}@example.test", "message": "Hello"})
    msg = [m for m in admin.get("/api/admin/messages").json() if m["email"] == f"q-{RUN}@example.test"]
    check("contact message stored unread", msg and msg[0]["read"] is False)
    check("mark message read", admin.patch(f"/api/admin/messages/{msg[0]['id']}", json={"read": True}).status_code == 200)
    anon.post("/api/newsletter", json={"email": f"News-{RUN}@Example.test"})
    check("subscriber stored lowercase", any(s["email"] == f"news-{RUN}@example.test" for s in admin.get("/api/admin/subscribers").json()))
    st = admin.get("/api/admin/stats").json()
    check("stats", st["orders"] >= 4 and len(st["sales_by_day"]) == 14, st.get("orders"))
    s0 = anon.get("/api/settings").json()
    r = admin.put("/api/admin/settings", json={**s0, "announcement_text": f"  Test {RUN}  "})
    check("settings update (upsert)", r.json()["announcement_text"] == f"Test {RUN}", r.text)
    admin.put("/api/admin/settings", json=s0)
    check("customer can't use admin API", cust.get("/api/admin/orders").status_code == 403)

    # Clean up rows this run created (orders/reviews are kept as history in a real DB; delete test product data)
    admin.delete(f"/api/admin/offers/{coupon['id']}")
    for rv in admin.get("/api/admin/reviews").json():
        if rv["product_id"] == pid:
            admin.delete(f"/api/admin/reviews/{rv['id']}")
    admin.delete(f"/api/admin/messages/{msg[0]['id']}")
    admin.delete(f"/api/admin/subscribers/news-{RUN}@example.test")

print("\nALL PASSED" if not fails else f"\n{len(fails)} FAILED: {fails}")
sys.exit(1 if fails else 0)
