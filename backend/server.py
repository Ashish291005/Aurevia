from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, Request, HTTPException, Response, Depends, UploadFile, File
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
import contextvars
import os
import re
import json
import time
import uuid
import logging
import bcrypt
import jwt
import secrets
import hmac
import hashlib
import base64
import httpx
from pathlib import Path
from typing import Annotated, List, Optional, Literal
from pydantic import AfterValidator, BaseModel, Field, field_validator
from collections import Counter
from datetime import datetime, timezone, timedelta
from bson import ObjectId

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
UPLOAD_DIR = ROOT_DIR / "uploads"
try:
    UPLOAD_DIR.mkdir(exist_ok=True)
except OSError:
    # Serverless platforms (e.g. Vercel) have a read-only code directory; /tmp is the only writable place.
    # Files there are not persistent, so production should use Supabase Storage (SUPABASE_URL/KEY).
    UPLOAD_DIR = Path("/tmp/aurevia-uploads")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Database: Supabase/Postgres (DATABASE_URL) > MongoDB (MONGO_URL) > in-memory dev fallback.
database_url = os.environ.get("DATABASE_URL", "").strip()
mongo_url = os.environ.get('MONGO_URL', '')
client = None
if database_url.startswith(("postgres://", "postgresql://")):
    from pgstore import PgDatabase
    db = PgDatabase(database_url)
    DB_BACKEND = "postgres"
elif mongo_url.startswith(("mongodb://", "mongodb+srv://")):
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get('DB_NAME', 'aurevia')]
    DB_BACKEND = "mongodb"
else:
    # Dev fallback so the app runs without a database. Data is lost when the server restarts.
    from mongomock_motor import AsyncMongoMockClient
    client = AsyncMongoMockClient()
    db = client[os.environ.get('DB_NAME', 'aurevia')]
    DB_BACKEND = "memory"
    logger.warning("No DATABASE_URL or MONGO_URL configured - using an IN-MEMORY database. Changes will be lost on restart.")
USING_MEMORY_DB = DB_BACKEND == "memory"
if USING_MEMORY_DB and os.environ.get("VERCEL"):
    # Each serverless instance would get its own empty database; data would appear and vanish at random.
    logger.error("Running on Vercel without DATABASE_URL: set it to your Supabase connection string.")
logger.info(f"Database backend: {DB_BACKEND}")

# Supabase Storage for uploaded images (persistent, unlike a free server's disk).
SUPABASE_URL = re.sub(r"/(rest|storage)/v1/?$", "", os.environ.get("SUPABASE_URL", "").strip().rstrip("/"))  # tolerate copied API URLs
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
SUPABASE_BUCKET = os.environ.get("SUPABASE_BUCKET", "product-images").strip()
USE_SUPABASE_STORAGE = bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)

app = FastAPI(title="Aurevia API")
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"
# Set COOKIE_SECURE=true in production (HTTPS) so auth cookies are never sent over plain HTTP.
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "").lower() in ("1", "true", "yes")
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


def verify_password(plain_password: str, hashed_password: Optional[str]) -> bool:
    # Accounts created with Google have no password until the customer sets one.
    return bool(hashed_password) and bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def get_jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET", "").strip()
    if not secret:
        logger.error("JWT_SECRET is not set - logins cannot work. Add it to the environment variables.")
        raise HTTPException(status_code=503, detail="Sign-in is not configured on the server yet (JWT_SECRET missing).")
    return secret


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": now_utc() + timedelta(minutes=15), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


# How long a device stays signed in without being used.
REMEMBER_DAYS = 30


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": now_utc() + timedelta(days=REMEMBER_DAYS), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, user_id: str, email: str):
    response.set_cookie(key="access_token", value=create_access_token(user_id, email), httponly=True, secure=COOKIE_SECURE, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=create_refresh_token(user_id), httponly=True, secure=COOKIE_SECURE, samesite="lax", max_age=REMEMBER_DAYS * 86400, path="/")


def public_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]), "email": user["email"], "name": user.get("name", ""),
        "role": user.get("role", "user"), "created_at": user.get("created_at"),
        "has_password": bool(user.get("password_hash")), "google": bool(user.get("google_sub")), "picture": user.get("picture", ""),
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


GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "").strip()


@api_router.get("/auth/providers")
async def auth_providers():
    """Which sign-in buttons the storefront should show (the client ID is public by design)."""
    return {"google_client_id": GOOGLE_CLIENT_ID or None}


class GoogleSignInInput(BaseModel):
    credential: str = Field(min_length=20, max_length=5000)


async def verify_google_credential(credential: str) -> dict:
    """Checks a "Sign in with Google" ID token with Google and returns its claims."""
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            r = await http.post("https://oauth2.googleapis.com/tokeninfo", data={"id_token": credential})
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Couldn't reach Google. Please try again.")
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Google sign-in failed. Please try again.")
    return r.json()


@api_router.post("/auth/google")
async def google_sign_in(input_data: GoogleSignInInput, response: Response):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google sign-in isn't set up yet.")
    claims = await verify_google_credential(input_data.credential)
    if (claims.get("aud") != GOOGLE_CLIENT_ID or claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com")
            or int(claims.get("exp", 0)) < now_utc().timestamp()):
        raise HTTPException(status_code=401, detail="Google sign-in failed. Please try again.")
    email = (claims.get("email") or "").strip().lower()
    if not email or str(claims.get("email_verified")).lower() != "true":
        raise HTTPException(status_code=401, detail="Your Google account's email isn't verified.")
    sub = str(claims["sub"])
    user = await db.users.find_one({"google_sub": sub}) or await db.users.find_one({"email": email})
    if user:
        # Same verified email: link Google to the existing account so its orders stay together.
        changes = {"google_sub": sub, "picture": claims.get("picture", "")}
        if not user.get("name"):
            changes["name"] = claims.get("name", "")
        await db.users.update_one({"_id": user["_id"]}, {"$set": changes})
        user.update(changes)
    else:
        user = {"email": email, "password_hash": None, "name": claims.get("name") or email.split("@")[0], "role": "user",
                "google_sub": sub, "picture": claims.get("picture", ""), "created_at": now_iso()}
        user["_id"] = (await db.users.insert_one(user)).inserted_id
    set_auth_cookies(response, str(user["_id"]), user["email"])
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
                    response.set_cookie(key="access_token", value=create_access_token(str(user["_id"]), user["email"]), httponly=True, secure=COOKIE_SECURE, samesite="lax", max_age=900, path="/")
        except (jwt.InvalidTokenError, ValueError):
            user = None
    return {"user": public_user(user) if user else None}


@api_router.patch("/auth/me")
async def update_me(input_data: ProfileInput, request: Request):
    user = await get_current_user(request)
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"name": input_data.name.strip()}})
    user["name"] = input_data.name.strip()
    return public_user(user)


# ---------- Saved addresses (address book on the customer's account) ----------

MAX_ADDRESSES = 10


class AddressInput(BaseModel):
    label: str = Field(default="Home", max_length=30)
    first_name: str = Field(min_length=1, max_length=60)
    last_name: str = Field(min_length=1, max_length=60)
    phone: str = Field(min_length=10, max_length=16)
    address: str = Field(min_length=1, max_length=200)
    city: str = Field(min_length=1, max_length=80)
    state: str = Field(min_length=1, max_length=60)
    zip: str = Field(min_length=6, max_length=6)
    is_default: bool = False

    @field_validator("phone")
    @classmethod
    def check_phone(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^(\+91[\s-]?)?[6-9][0-9]{4}[\s-]?[0-9]{5}$", v):
            raise ValueError("Enter a 10-digit Indian mobile number")
        return v

    @field_validator("zip")
    @classmethod
    def check_zip(cls, v: str) -> str:
        if not re.match(r"^[1-9][0-9]{5}$", v.strip()):
            raise ValueError("Enter a 6-digit PIN code")
        return v.strip()


def _clean_address(data: AddressInput) -> dict:
    doc = data.model_dump()
    return {k: v.strip() if isinstance(v, str) else v for k, v in doc.items()}


async def _save_addresses(user: dict, addresses: List[dict]) -> List[dict]:
    # Exactly one default whenever there are addresses.
    if addresses and not any(a.get("is_default") for a in addresses):
        addresses[0]["is_default"] = True
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"addresses": addresses}})
    return addresses


@api_router.get("/account/addresses")
async def list_addresses(request: Request):
    return (await get_current_user(request)).get("addresses", [])


@api_router.post("/account/addresses", status_code=201)
async def add_address(input_data: AddressInput, request: Request):
    user = await get_current_user(request)
    addresses = user.get("addresses", [])
    doc = _clean_address(input_data)
    # The same address saved again (e.g. from checkout) just becomes the latest; no duplicates.
    same = lambda a: all(a.get(k, "").lower() == doc[k].lower() for k in ("address", "city", "zip", "phone"))  # noqa: E731
    existing = next((a for a in addresses if same(a)), None)
    if existing:
        return existing
    if len(addresses) >= MAX_ADDRESSES:
        raise HTTPException(status_code=400, detail=f"You can save up to {MAX_ADDRESSES} addresses. Delete one first.")
    doc["id"] = uuid.uuid4().hex
    if doc["is_default"]:
        for a in addresses:
            a["is_default"] = False
    addresses.append(doc)
    await _save_addresses(user, addresses)
    return doc


@api_router.put("/account/addresses/{address_id}")
async def update_address(address_id: str, input_data: AddressInput, request: Request):
    user = await get_current_user(request)
    addresses = user.get("addresses", [])
    current = next((a for a in addresses if a["id"] == address_id), None)
    if not current:
        raise HTTPException(status_code=404, detail="Address not found")
    current.update(_clean_address(input_data))
    if current["is_default"]:
        for a in addresses:
            a["is_default"] = a["id"] == address_id
    await _save_addresses(user, addresses)
    return current


@api_router.delete("/account/addresses/{address_id}")
async def delete_address(address_id: str, request: Request):
    user = await get_current_user(request)
    addresses = [a for a in user.get("addresses", []) if a["id"] != address_id]
    if len(addresses) == len(user.get("addresses", [])):
        raise HTTPException(status_code=404, detail="Address not found")
    return await _save_addresses(user, addresses)


@api_router.post("/auth/change-password")
async def change_password(input_data: ChangePasswordInput, request: Request):
    user = await get_current_user(request)
    # Google-only accounts may add a password without a current one.
    if user.get("password_hash") and not verify_password(input_data.current_password, user["password_hash"]):
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
        response.set_cookie(key="access_token", value=create_access_token(str(user["_id"]), user["email"]), httponly=True, secure=COOKIE_SECURE, samesite="lax", max_age=900, path="/")
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
    "announcement_text": "Free shipping on orders above ₹999 · Cash on delivery across India",
    "shipping_fee": 79.0,
    "free_shipping_threshold": 999.0,
    "store_email": "hello@aurevia.in",
    "store_phone": "+91 98765 43210",
    "store_address": "Shop 12, Linking Road, Bandra West, Mumbai 400050",
    "instagram_url": "",
    "facebook_url": "",
    "twitter_url": "",
    "whatsapp_number": "",
    "ticker_messages": ["Anti-tarnish & skin-safe", "Cash on delivery across India", "Easy 7-day returns"],
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
    whatsapp_number: str = Field(default="", max_length=20)
    ticker_messages: List[str] = Field(default_factory=list, max_length=8)

    @field_validator("whatsapp_number")
    @classmethod
    def check_whatsapp(cls, v: str) -> str:
        digits = re.sub(r"\D", "", v)
        if digits and not (10 <= len(digits) <= 13):
            raise ValueError("WhatsApp number should be 10 digits (optionally with country code 91)")
        return digits

    @field_validator("ticker_messages")
    @classmethod
    def clean_ticker(cls, v: List[str]) -> List[str]:
        return [m.strip()[:80] for m in v if m.strip()]

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


# ---------- Reviews ----------

class ReviewInput(BaseModel):
    rating: int = Field(ge=1, le=5)
    title: str = Field(default="", max_length=80)
    body: str = Field(min_length=3, max_length=1500)


async def refresh_rating(product_id: str):
    reviews = await db.reviews.find({"product_id": product_id, "hidden": {"$ne": True}}, {"_id": 0, "rating": 1}).to_list(10000)
    count = len(reviews)
    avg = round(sum(r["rating"] for r in reviews) / count, 1) if count else 0
    await db.products.update_one({"id": product_id}, {"$set": {"rating_avg": avg, "rating_count": count}})


@api_router.get("/products/{product_id}/reviews")
async def product_reviews(product_id: str):
    return await db.reviews.find({"product_id": product_id, "hidden": {"$ne": True}}, {"_id": 0, "user_id": 0}).sort("created_at", -1).to_list(200)


@api_router.post("/products/{product_id}/reviews", status_code=201)
async def add_review(product_id: str, input_data: ReviewInput, request: Request):
    user = await get_current_user(request)
    product = await db.products.find_one({"id": product_id, **PUBLIC_PRODUCTS}, {"_id": 0, "id": 1, "name": 1})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    uid = str(user["_id"])
    bought = await db.orders.find_one({"items.product_id": product_id, "status": {"$ne": "cancelled"},
                                       "$or": [{"user_id": uid}, {"customer.email": user["email"]}]}, {"_id": 1})
    ts = now_iso()
    doc = {"product_id": product_id, "product_name": product["name"], "user_id": uid, "name": user.get("name") or "Customer",
           "rating": input_data.rating, "title": input_data.title.strip(), "body": input_data.body.strip(),
           "verified": bool(bought), "updated_at": ts}
    existing = await db.reviews.find_one({"product_id": product_id, "user_id": uid}, {"_id": 0, "id": 1})
    if existing:
        await db.reviews.update_one({"id": existing["id"]}, {"$set": doc})
        doc["id"] = existing["id"]
    else:
        doc.update({"id": uuid.uuid4().hex, "created_at": ts, "hidden": False})
        await db.reviews.insert_one(doc)
    await refresh_rating(product_id)
    doc.pop("_id", None)
    doc.pop("user_id", None)
    return doc


@api_router.get("/reviews/latest")
async def latest_reviews():
    return await db.reviews.find({"hidden": {"$ne": True}, "rating": {"$gte": 4}}, {"_id": 0, "user_id": 0}).sort("created_at", -1).to_list(9)


@api_router.get("/admin/reviews")
async def admin_reviews(admin: dict = Depends(require_admin)):
    return await db.reviews.find({}, {"_id": 0, "user_id": 0}).sort("created_at", -1).to_list(2000)


class ReviewModerationInput(BaseModel):
    hidden: bool


@api_router.patch("/admin/reviews/{review_id}")
async def moderate_review(review_id: str, input_data: ReviewModerationInput, admin: dict = Depends(require_admin)):
    review = await db.reviews.find_one({"id": review_id}, {"_id": 0})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    await db.reviews.update_one({"id": review_id}, {"$set": {"hidden": input_data.hidden}})
    await refresh_rating(review["product_id"])
    return {"message": "Review hidden" if input_data.hidden else "Review visible"}


@api_router.delete("/admin/reviews/{review_id}")
async def delete_review(review_id: str, admin: dict = Depends(require_admin)):
    review = await db.reviews.find_one({"id": review_id}, {"_id": 0})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    await db.reviews.delete_one({"id": review_id})
    await refresh_rating(review["product_id"])
    return {"message": "Review deleted"}


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
        if (url.startswith("/uploads/") or (USE_SUPABASE_STORAGE and url.startswith(SUPABASE_URL))) \
                and not await db.products.find_one({"images": url}, {"_id": 1}) \
                and not await db.orders.find_one({"items.image": url}, {"_id": 1}):
            await delete_uploaded_image(url)
    logger.info(f"Product deleted by {admin['email']}: {product_id}")
    return {"message": f"Deleted {product['name']}"}


ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
MAX_UPLOAD_BYTES = 4 * 1024 * 1024  # Vercel functions accept request bodies up to 4.5 MB


@api_router.post("/admin/upload")
async def upload_image(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    ext = ALLOWED_IMAGE_TYPES.get(file.content_type)
    if not ext:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP or GIF images are allowed")
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Image must be 4 MB or smaller")
    filename = f"{uuid.uuid4().hex}{ext}"
    if USE_SUPABASE_STORAGE:
        return {"url": await supabase_upload(filename, content, file.content_type)}
    (UPLOAD_DIR / filename).write_bytes(content)
    return {"url": f"/uploads/{filename}"}


def supabase_public_url(filename: str) -> str:
    return f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/{filename}"


async def supabase_upload(filename: str, content: bytes, content_type: str) -> str:
    headers = {"Authorization": f"Bearer {SUPABASE_SERVICE_KEY}", "apikey": SUPABASE_SERVICE_KEY, "Content-Type": content_type, "Cache-Control": "31536000"}
    try:
        async with httpx.AsyncClient(timeout=30) as http:
            r = await http.post(f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{filename}", content=content, headers=headers)
    except httpx.HTTPError:
        logger.exception("Supabase Storage unreachable")
        raise HTTPException(status_code=502, detail="Image storage is unreachable. Please try again.")
    if r.status_code >= 300:
        logger.error(f"Supabase upload failed: {r.status_code} {r.text[:300]}")
        raise HTTPException(status_code=502, detail="Image storage rejected the upload. Check the bucket exists and is public.")
    return supabase_public_url(filename)


async def delete_uploaded_image(url: str):
    if url.startswith("/uploads/"):
        (UPLOAD_DIR / Path(url).name).unlink(missing_ok=True)
    elif USE_SUPABASE_STORAGE and url.startswith(supabase_public_url("")):
        name = url[len(supabase_public_url("")):]
        try:
            async with httpx.AsyncClient(timeout=15) as http:
                await http.request("DELETE", f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}", json={"prefixes": [name]},
                                   headers={"Authorization": f"Bearer {SUPABASE_SERVICE_KEY}", "apikey": SUPABASE_SERVICE_KEY})
        except httpx.HTTPError:
            logger.warning(f"Could not delete {name} from Supabase Storage")


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
    ends_at: Optional[str] = Field(default=None, max_length=40)

    @field_validator("ends_at")
    @classmethod
    def check_ends_at(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        try:
            dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
        except ValueError:
            raise ValueError("End date must be a valid date and time")
        return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).astimezone(timezone.utc).isoformat()

    @field_validator("code")
    @classmethod
    def clean_code(cls, v: str) -> str:
        v = v.strip().upper()
        if v and not re.match(r"^[A-Z0-9_-]{3,30}$", v):
            raise ValueError("Coupon codes use 3-30 letters, numbers, - or _")
        return v


class ReorderInput(BaseModel):
    ids: List[str] = Field(min_length=1, max_length=500)


async def validate_offer(doc: dict) -> dict:
    # Offers only *display* a coupon; its rules live on the Coupons page.
    if doc["code"] and not await db.coupons.find_one({"code": doc["code"]}, {"_id": 1}):
        raise HTTPException(status_code=422, detail=f"There's no coupon {doc['code']}. Create it on the Coupons page first.")
    doc.update({"discount_type": "none", "discount_value": 0, "min_order": 0})
    return doc


CONTENT = {
    "categories": {"model": CategoryInput, "label": "Category"},
    "slides": {"model": SlideInput, "label": "Slide"},
    "offers": {"model": OfferInput, "label": "Offer"},
}


def offer_expired(o: dict) -> bool:
    return bool(o.get("ends_at")) and o["ends_at"] <= now_iso()


async def list_content(kind: str, only_active: bool = False) -> List[dict]:
    items = await db[kind].find({"active": True} if only_active else {}, {"_id": 0}).sort("position", 1).to_list(500)
    if only_active and kind == "offers":
        items = [o for o in items if not offer_expired(o)]
    return items


async def prepare_content(kind: str, data: BaseModel, current: Optional[dict] = None) -> dict:
    doc = data.model_dump()
    for k, v in doc.items():
        if isinstance(v, str):
            doc[k] = v.strip()
    others = [x for x in await db[kind].find({}, {"_id": 0}).to_list(500) if not current or x["id"] != current["id"]]
    if kind == "categories" and any(x["name"].lower() == doc["name"].lower() for x in others):
        raise HTTPException(status_code=409, detail=f"A category called '{doc['name']}' already exists.")
    if kind == "offers":
        await validate_offer(doc)
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
    # A handful of queries run together (the homepage waits on this): one per collection, not one per item.
    slides, categories, offers, products, coupons = await asyncio.gather(
        list_content("slides", only_active=True),
        list_content("categories", only_active=True),
        list_content("offers", only_active=True),
        db.products.find(PUBLIC_PRODUCTS, {"_id": 0, "category": 1}).to_list(5000),
        db.coupons.find({"active": True}, {"_id": 0}).to_list(500),
    )
    counts = Counter(p.get("category") for p in products)
    for c in categories:
        c["product_count"] = counts.get(c["name"], 0)
    by_code = {c["code"]: c for c in coupons}
    shown = {o["code"] for o in offers if o.get("code") in by_code and coupon_live(by_code[o["code"]])}
    used_up = dict(zip(shown, await asyncio.gather(*(coupon_used_up(by_code[code]) for code in shown))))
    for o in offers:
        # Show a code only while its coupon can actually be used; otherwise the offer is an announcement.
        if o.get("code") in shown and not used_up[o["code"]]:
            o["coupon"] = public_coupon(by_code[o["code"]])
        else:
            o["code"] = ""
    return {"slides": slides, "categories": categories, "offers": offers}


# ---------- Coupons ----------
# Codes and their rules. Offers (banners/popup) can display one; checkout applies them.

def _utc_iso(v: Optional[str], label: str) -> Optional[str]:
    if not v:
        return None
    try:
        dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        raise ValueError(f"{label} must be a valid date and time")
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).astimezone(timezone.utc).isoformat()


class CouponDocInput(BaseModel):
    code: str = Field(min_length=3, max_length=30)
    description: str = Field(default="", max_length=120)
    discount_type: Literal["percent", "flat", "free_shipping"] = "percent"
    discount_value: float = Field(default=0, ge=0)        # unused for free_shipping
    max_discount: float = Field(default=0, ge=0)          # percent only; 0 = no cap
    min_order: float = Field(default=0, ge=0)
    starts_at: Optional[str] = Field(default=None, max_length=40)
    ends_at: Optional[str] = Field(default=None, max_length=40)
    usage_limit: int = Field(default=0, ge=0)             # total uses; 0 = unlimited
    per_customer_limit: int = Field(default=1, ge=0)      # per email; 0 = unlimited
    first_order_only: bool = False
    show_in_cart: bool = True                             # suggested in cart/checkout; off = private code
    terms: str = Field(default="", max_length=2000)
    active: bool = True

    @field_validator("code")
    @classmethod
    def clean_code(cls, v: str) -> str:
        v = v.strip().upper()
        if not re.match(r"^[A-Z0-9_-]{3,30}$", v):
            raise ValueError("Coupon codes use 3-30 letters, numbers, - or _")
        return v

    @field_validator("starts_at")
    @classmethod
    def check_starts(cls, v):
        return _utc_iso(v, "Start date")

    @field_validator("ends_at")
    @classmethod
    def check_ends(cls, v):
        return _utc_iso(v, "End date")


def coupon_live(c: dict) -> bool:
    now = now_iso()
    return c.get("active", True) and not (c.get("starts_at") and c["starts_at"] > now) and not (c.get("ends_at") and c["ends_at"] <= now)


async def coupon_used_count(code: str, email: Optional[str] = None) -> int:
    flt = {"coupon.code": code, "status": {"$ne": "cancelled"}}
    if email:
        flt["customer.email"] = email.strip().lower()
    return await db.orders.count_documents(flt)


async def coupon_used_up(c: dict) -> bool:
    return bool(c.get("usage_limit")) and await coupon_used_count(c["code"]) >= c["usage_limit"]


def public_coupon(c: dict) -> dict:
    return {k: c.get(k) for k in ("code", "description", "discount_type", "discount_value", "max_discount", "min_order",
                                  "ends_at", "first_order_only", "per_customer_limit", "terms")}


async def find_coupon(code: str, email: str = "") -> dict:
    """The coupon if this customer may use it now; otherwise a 400 saying why. Minimum order is checked separately."""
    c = await db.coupons.find_one({"code": code.strip().upper()}, {"_id": 0})
    now = now_iso()
    if not c or not c.get("active", True) or (c.get("ends_at") and c["ends_at"] <= now):
        raise HTTPException(status_code=400, detail="This coupon code isn't valid or has expired.")
    if c.get("starts_at") and c["starts_at"] > now:
        raise HTTPException(status_code=400, detail=f"{c['code']} isn't active yet.")
    if await coupon_used_up(c):
        raise HTTPException(status_code=400, detail=f"{c['code']} has reached its usage limit.")
    email = (email or "").strip().lower()
    if email:
        if c.get("first_order_only") and await db.orders.count_documents({"customer.email": email, "status": {"$ne": "cancelled"}}):
            raise HTTPException(status_code=400, detail=f"{c['code']} is only for your first order.")
        limit = c.get("per_customer_limit", 0)
        if limit and await coupon_used_count(c["code"], email) >= limit:
            raise HTTPException(status_code=400, detail=f"You've already used {c['code']}" + (" the maximum number of times." if limit > 1 else "."))
    return c


def coupon_discount(c: dict, subtotal: float) -> float:
    if subtotal < c.get("min_order", 0):
        short = c["min_order"] - subtotal
        raise HTTPException(status_code=400, detail=f"Add ₹{short:,.0f} more to use {c['code']} (minimum order ₹{c['min_order']:,.0f}).")
    if c["discount_type"] == "free_shipping":
        return 0.0  # the saving is the delivery charge, waived when the order is priced
    if c["discount_type"] == "percent":
        d = round(subtotal * c["discount_value"] / 100, 2)
        return min(d, c["max_discount"]) if c.get("max_discount") else d
    return round(min(c["discount_value"], subtotal), 2)


class CouponInput(BaseModel):
    code: str = Field(min_length=1, max_length=30)
    subtotal: float = Field(ge=0)
    email: str = Field(default="", max_length=200)


@api_router.post("/coupons/validate")
async def validate_coupon(input_data: CouponInput):
    c = await find_coupon(input_data.code, input_data.email)
    try:
        discount, error = coupon_discount(c, input_data.subtotal), ""
    except HTTPException as e:
        # Below the minimum: still return the rules so the cart can show how much more to add.
        discount, error = 0.0, e.detail
    return {**public_coupon(c), "discount": discount, "error": error}


@api_router.get("/coupons/available")
async def available_coupons():
    """Codes suggested in the cart and at checkout."""
    out = []
    for c in await db.coupons.find({"active": True, "show_in_cart": True}, {"_id": 0}).sort("created_at", 1).to_list(100):
        if coupon_live(c) and not await coupon_used_up(c):
            out.append(public_coupon(c))
    return out


async def prepare_coupon(data: CouponDocInput, current: Optional[dict] = None) -> dict:
    doc = data.model_dump()
    doc["description"], doc["terms"] = doc["description"].strip(), doc["terms"].strip()
    if doc["discount_type"] == "free_shipping":
        doc.update({"discount_value": 0, "max_discount": 0})
    elif doc["discount_value"] <= 0:
        raise HTTPException(status_code=422, detail="Enter how much the coupon takes off.")
    elif doc["discount_type"] == "percent":
        if doc["discount_value"] > 90:
            raise HTTPException(status_code=422, detail="Percentage discounts can be at most 90%.")
    else:
        doc["max_discount"] = 0
    if doc["starts_at"] and doc["ends_at"] and doc["ends_at"] <= doc["starts_at"]:
        raise HTTPException(status_code=422, detail="The end date must be after the start date.")
    clash = await db.coupons.find_one({"code": doc["code"]}, {"_id": 0, "id": 1})
    if clash and (not current or clash["id"] != current["id"]):
        raise HTTPException(status_code=409, detail=f"A coupon {doc['code']} already exists.")
    return doc


async def with_usage(c: dict) -> dict:
    return {**c, "used_count": await coupon_used_count(c["code"])}


@api_router.get("/admin/coupons")
async def admin_coupons(admin: dict = Depends(require_admin)):
    return [await with_usage(c) for c in await db.coupons.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)]


@api_router.post("/admin/coupons", status_code=201)
async def admin_create_coupon(input_data: CouponDocInput, admin: dict = Depends(require_admin)):
    doc = await prepare_coupon(input_data)
    doc.update({"id": uuid.uuid4().hex, "created_at": now_iso(), "updated_at": now_iso()})
    await db.coupons.insert_one(doc)
    doc.pop("_id", None)
    return await with_usage(doc)


@api_router.put("/admin/coupons/{coupon_id}")
async def admin_update_coupon(coupon_id: str, input_data: CouponDocInput, admin: dict = Depends(require_admin)):
    current = await db.coupons.find_one({"id": coupon_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Coupon not found")
    doc = await prepare_coupon(input_data, current)
    await db.coupons.update_one({"id": coupon_id}, {"$set": {**doc, "updated_at": now_iso()}})
    if doc["code"] != current["code"]:
        # Banners showing the old code follow the rename.
        await db.offers.update_many({"code": current["code"]}, {"$set": {"code": doc["code"]}})
    return await with_usage(await db.coupons.find_one({"id": coupon_id}, {"_id": 0}))


@api_router.delete("/admin/coupons/{coupon_id}")
async def admin_delete_coupon(coupon_id: str, admin: dict = Depends(require_admin)):
    current = await db.coupons.find_one({"id": coupon_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Coupon not found")
    await db.coupons.delete_one({"id": coupon_id})
    # Banners that showed it become plain announcements; past orders keep their discount.
    await db.offers.update_many({"code": current["code"]}, {"$set": {"code": ""}})
    return {"message": "Coupon deleted"}


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
    payment_method: Literal["cod", "razorpay"] = "cod"
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
    if input_data.payment_method == "razorpay" and not razorpay_enabled():
        raise HTTPException(status_code=400, detail="Online payment isn't available right now. Please choose cash on delivery.")

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
            c = await find_coupon(input_data.coupon_code, input_data.customer.email)
            discount = coupon_discount(c, subtotal)
            coupon = {"code": c["code"], "title": c.get("description") or c["code"]}
            if c["discount_type"] == "free_shipping":
                coupon["free_shipping"] = True
                shipping = 0.0
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
    if input_data.payment_method == "razorpay":
        # Amount comes from the server-side total, never from the browser.
        try:
            rp = await razorpay_create_order(order["total"], order["number"])
        except HTTPException:
            await restock(reserved)
            raise
        order["razorpay_order_id"] = rp["id"]
    await db.orders.insert_one(order)
    order.pop("_id", None)
    logger.info(f"Order {order['number']} placed ({order['total']}, {order['payment_method']})")
    if input_data.payment_method == "razorpay":
        order["razorpay"] = {"key_id": RAZORPAY_KEY_ID, "order_id": order["razorpay_order_id"],
                             "amount": rupees_to_paise(order["total"]), "currency": "INR"}
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
        if order["payment_method"] == "razorpay" and order["payment_status"] != "paid" and new_status in ("processing", "shipped", "delivered"):
            raise HTTPException(status_code=400, detail="This online order hasn't been paid yet, so it can't be fulfilled.")
        if new_status == "cancelled":
            await restock(order["items"])
            awb = order.get("nimbus", {}).get("awb")
            if awb and nimbus_enabled():
                # Best effort: also cancel the courier booking (fails once it is picked up).
                try:
                    if (await nimbus_request("POST", "/shipments/cancel", {"awb": awb})).get("status"):
                        changes.update({"nimbus": {**order["nimbus"], "awb": "", "cancelled_awb": awb, "status_text": "Shipment cancelled"},
                                        "tracking_number": "", "tracking_url": ""})
                except HTTPException:
                    logger.warning(f"Could not cancel Nimbus shipment {awb} for order {order['number']}")
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


# ---------- Shipping: NimbusPost ----------
# Admin books a courier for an order; Nimbus returns the AWB, courier and label. API: api.nimbuspost.com/v1.

NIMBUS_API = "https://api.nimbuspost.com/v1"
NIMBUS_EMAIL = os.environ.get("NIMBUS_EMAIL", "").strip()
NIMBUS_PASSWORD = os.environ.get("NIMBUS_PASSWORD", "").strip()
_nimbus_token = {"value": None, "at": 0.0}

SHIPPING_DEFAULTS = {
    "nimbus_subdomain": "aurevia",          # tracking pages live at <subdomain>.nmbus.co/track/<awb>
    "warehouse_name": "", "pickup_name": "", "pickup_address": "", "pickup_address_2": "",
    "pickup_city": "", "pickup_state": "", "pickup_pincode": "", "pickup_phone": "",
    "package_weight": 250, "package_length": 15, "package_breadth": 12, "package_height": 6,
    "auto_pickup": True,
}

# Nimbus tracking codes -> our order status.
NIMBUS_STATUS = {"IT": "shipped", "OFD": "shipped", "DL": "delivered"}
NIMBUS_LABELS = {"PP": "Pending pickup", "IT": "In transit", "EX": "Exception", "OFD": "Out for delivery", "DL": "Delivered",
                 "RT": "Returning to origin (RTO)", "RT-IT": "RTO in transit", "RT-DL": "RTO delivered"}


def nimbus_enabled() -> bool:
    return bool(NIMBUS_EMAIL and NIMBUS_PASSWORD)


class ShippingSettingsInput(BaseModel):
    nimbus_subdomain: str = Field(default="", max_length=60)
    warehouse_name: str = Field(default="", max_length=20)
    pickup_name: str = Field(default="", max_length=200)
    pickup_address: str = Field(default="", max_length=200)
    pickup_address_2: str = Field(default="", max_length=200)
    pickup_city: str = Field(default="", max_length=40)
    pickup_state: str = Field(default="", max_length=40)
    pickup_pincode: str = Field(default="", max_length=6)
    pickup_phone: str = Field(default="", max_length=16)
    package_weight: int = Field(default=250, ge=1, le=50000)
    package_length: int = Field(default=15, ge=1, le=500)
    package_breadth: int = Field(default=12, ge=1, le=500)
    package_height: int = Field(default=6, ge=1, le=500)
    auto_pickup: bool = True


async def get_shipping_settings() -> dict:
    doc = await db.settings.find_one({"_id": "shipping"}, {"_id": 0}) or {}
    return {**SHIPPING_DEFAULTS, **doc}


@api_router.get("/admin/shipping")
async def admin_shipping_settings(admin: dict = Depends(require_admin)):
    return {**await get_shipping_settings(), "nimbus_connected": nimbus_enabled()}


@api_router.put("/admin/shipping")
async def admin_update_shipping(input_data: ShippingSettingsInput, admin: dict = Depends(require_admin)):
    doc = {k: v.strip() if isinstance(v, str) else v for k, v in input_data.model_dump().items()}
    if doc["pickup_pincode"] and not re.match(r"^[1-9][0-9]{5}$", doc["pickup_pincode"]):
        raise HTTPException(status_code=422, detail="Pickup PIN code must be 6 digits.")
    await db.settings.update_one({"_id": "shipping"}, {"$set": doc}, upsert=True)
    return {**await get_shipping_settings(), "nimbus_connected": nimbus_enabled()}


async def nimbus_request(method: str, path: str, json_body: Optional[dict] = None) -> dict:
    """Calls Nimbus with a cached login token, logging in again once if it has expired."""
    if not nimbus_enabled():
        raise HTTPException(status_code=503, detail="Nimbus is not connected yet. Add NIMBUS_EMAIL and NIMBUS_PASSWORD on the server.")
    for attempt in range(2):
        if not _nimbus_token["value"] or time.time() - _nimbus_token["at"] > 2 * 3600:
            try:
                async with httpx.AsyncClient(timeout=20) as http:
                    r = await http.post(f"{NIMBUS_API}/users/login", json={"email": NIMBUS_EMAIL, "password": NIMBUS_PASSWORD})
                body = r.json()
            except (httpx.HTTPError, ValueError):
                raise HTTPException(status_code=502, detail="Could not reach Nimbus to log in. Please try again.")
            if not body.get("status"):
                raise HTTPException(status_code=502, detail=f"Nimbus login failed: {body.get('message') or r.status_code}. Check NIMBUS_EMAIL / NIMBUS_PASSWORD.")
            _nimbus_token.update(value=body["data"], at=time.time())
        try:
            async with httpx.AsyncClient(timeout=30) as http:
                r = await http.request(method, f"{NIMBUS_API}{path}", json=json_body, headers={"Authorization": f"Bearer {_nimbus_token['value']}"})
        except httpx.HTTPError:
            raise HTTPException(status_code=502, detail="Could not reach Nimbus. Please try again.")
        if r.status_code == 401 and attempt == 0:
            _nimbus_token["value"] = None
            continue
        try:
            return r.json()
        except ValueError:
            raise HTTPException(status_code=502, detail=f"Nimbus returned an unexpected response ({r.status_code}).")
    raise HTTPException(status_code=502, detail="Nimbus rejected the login token.")


def _ten_digits(phone: str) -> str:
    return re.sub(r"\D", "", phone or "")[-10:]


def nimbus_tracking_url(settings: dict, awb: str) -> str:
    sub = (settings.get("nimbus_subdomain") or "").strip()
    return f"https://{sub}.nmbus.co/track/{awb}" if sub else f"https://app.nimbuspost.com/track/{awb}"


class NimbusShipInput(BaseModel):
    package_weight: Optional[int] = Field(default=None, ge=1, le=50000)
    package_length: Optional[int] = Field(default=None, ge=1, le=500)
    package_breadth: Optional[int] = Field(default=None, ge=1, le=500)
    package_height: Optional[int] = Field(default=None, ge=1, le=500)
    courier_id: Optional[str] = Field(default=None, max_length=10)


def build_nimbus_shipment(order: dict, s: dict, pkg: NimbusShipInput) -> dict:
    c = order["customer"]
    cod = order["payment_method"] == "cod" and order["payment_status"] != "paid"
    payload = {
        "order_number": order["number"][:20],
        "payment_type": "cod" if cod else "prepaid",
        "order_amount": round(order["total"], 2),
        "shipping_charges": round(order.get("shipping", 0), 2),
        "discount": round(order.get("discount", 0), 2),
        "cod_charges": 0,
        "package_weight": pkg.package_weight or s["package_weight"],
        "package_length": pkg.package_length or s["package_length"],
        "package_breadth": pkg.package_breadth or s["package_breadth"],
        "package_height": pkg.package_height or s["package_height"],
        "request_auto_pickup": "yes" if s.get("auto_pickup", True) else "no",
        "consignee": {
            "name": f"{c['first_name']} {c['last_name']}".strip()[:200], "address": c["address"][:200], "address_2": "",
            "city": c["city"][:40], "state": (c.get("state") or "")[:40], "pincode": c["zip"], "phone": _ten_digits(c.get("phone")),
        },
        "pickup": {
            "warehouse_name": s["warehouse_name"], "name": s["pickup_name"], "address": s["pickup_address"], "address_2": s.get("pickup_address_2", ""),
            "city": s["pickup_city"], "state": s["pickup_state"], "pincode": s["pickup_pincode"], "phone": _ten_digits(s["pickup_phone"]),
        },
        "order_items": [{"name": i["name"][:200], "qty": str(i["quantity"]), "price": str(i["price"]), "sku": i["product_id"]} for i in order["items"]],
        "is_insurance": "0",
        "tags": "aurevia",
    }
    if pkg.courier_id:
        payload["courier_id"] = pkg.courier_id
    return payload


@api_router.post("/admin/orders/{order_id}/nimbus")
async def ship_with_nimbus(order_id: str, input_data: NimbusShipInput, admin: dict = Depends(require_admin)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] == "cancelled":
        raise HTTPException(status_code=400, detail="This order is cancelled.")
    if order.get("nimbus", {}).get("awb"):
        raise HTTPException(status_code=409, detail=f"Already booked with Nimbus (AWB {order['nimbus']['awb']}). Cancel that shipment first to book again.")
    if order["payment_method"] == "razorpay" and order["payment_status"] != "paid":
        raise HTTPException(status_code=400, detail="This online order has not been paid yet, so it can't be shipped.")
    s = await get_shipping_settings()
    required = (("warehouse_name", "warehouse name"), ("pickup_name", "contact name"), ("pickup_address", "address"),
                ("pickup_city", "city"), ("pickup_state", "state"), ("pickup_pincode", "PIN code"), ("pickup_phone", "phone"))
    missing = [label for key, label in required if not s.get(key)]
    if missing:
        raise HTTPException(status_code=400, detail=f"Fill in your pickup {', '.join(missing)} in Settings → Shipping first.")
    body = await nimbus_request("POST", "/shipments", build_nimbus_shipment(order, s, input_data))
    if not body.get("status"):
        raise HTTPException(status_code=400, detail=f"Nimbus: {(body.get('message') or 'could not create the shipment').strip()}")
    d = body["data"]
    ts = now_iso()
    nimbus = {"awb": str(d.get("awb_number", "")), "courier_name": d.get("courier_name", ""), "courier_id": str(d.get("courier_id", "")),
              "shipment_id": d.get("shipment_id"), "order_id": d.get("order_id"), "label": d.get("label", ""), "manifest": d.get("manifest", ""),
              "status_code": "PP", "status_text": NIMBUS_LABELS["PP"], "booked_at": ts}
    changes = {"nimbus": nimbus, "tracking_number": nimbus["awb"], "tracking_url": nimbus_tracking_url(s, nimbus["awb"]),
               "courier": nimbus["courier_name"], "updated_at": ts}
    if order["status"] == "pending":
        changes["status"] = "processing"
    entry = {"status": changes.get("status", order["status"]), "at": ts,
             "by": f"{admin['email']} · Nimbus booked {nimbus['courier_name']} (AWB {nimbus['awb']})"}
    await db.orders.update_one({"id": order_id}, {"$set": changes, "$push": {"history": entry}})
    return await db.orders.find_one({"id": order_id}, {"_id": 0})


@api_router.post("/admin/orders/{order_id}/nimbus/sync")
async def sync_nimbus(order_id: str, admin: dict = Depends(require_admin)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    awb = (order or {}).get("nimbus", {}).get("awb")
    if not awb:
        raise HTTPException(status_code=404, detail="This order has no Nimbus shipment.")
    body = await nimbus_request("GET", f"/shipments/track/{awb}")
    if not body.get("status"):
        raise HTTPException(status_code=400, detail=f"Nimbus: {body.get('message') or 'no tracking yet'}")
    history = body["data"].get("history") or []
    code = history[0].get("status_code") if history else order["nimbus"].get("status_code", "PP")
    ts = now_iso()
    # Whole sub-document, not dotted paths: the Postgres store only sets top-level fields.
    nimbus = {**order["nimbus"], "status_code": code, "status_text": NIMBUS_LABELS.get(code, code), "history": history[:30], "synced_at": ts}
    changes = {"nimbus": nimbus, "updated_at": ts}
    update = {"$set": changes}
    target = NIMBUS_STATUS.get(code)
    current = ORDER_STATUSES.index(order["status"]) if order["status"] in ORDER_STATUSES else 0
    # Only move forward (never undo an admin's later status), and never reopen a cancelled order.
    if target and order["status"] != "cancelled" and ORDER_STATUSES.index(target) > current:
        changes["status"] = target
        if target == "delivered" and order["payment_method"] == "cod":
            changes["payment_status"] = "paid"
        update["$push"] = {"history": {"status": target, "at": ts, "by": f"Nimbus: {NIMBUS_LABELS.get(code, code)}"}}
    await db.orders.update_one({"id": order_id}, update)
    return await db.orders.find_one({"id": order_id}, {"_id": 0})


@api_router.post("/admin/orders/{order_id}/nimbus/cancel")
async def cancel_nimbus(order_id: str, admin: dict = Depends(require_admin)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    awb = (order or {}).get("nimbus", {}).get("awb")
    if not awb:
        raise HTTPException(status_code=404, detail="This order has no Nimbus shipment.")
    body = await nimbus_request("POST", "/shipments/cancel", {"awb": awb})
    if not body.get("status"):
        raise HTTPException(status_code=400, detail=f"Nimbus: {body.get('message') or 'unable to cancel'} (it may already be picked up).")
    ts = now_iso()
    nimbus = {**order["nimbus"], "awb": "", "cancelled_awb": awb, "status_text": "Shipment cancelled"}
    await db.orders.update_one({"id": order_id}, {
        "$set": {"nimbus": nimbus, "tracking_number": "", "tracking_url": "", "courier": "", "updated_at": ts},
        "$push": {"history": {"status": order["status"], "at": ts, "by": f"{admin['email']} · Nimbus shipment {awb} cancelled"}},
    })
    return await db.orders.find_one({"id": order_id}, {"_id": 0})


# ---------- Admin: dashboard, customers, messages, subscribers ----------

# ---------- Payments (Razorpay) ----------

RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "").strip()
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "").strip()
RAZORPAY_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "").strip()


def razorpay_enabled() -> bool:
    return bool(RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)


def rupees_to_paise(amount: float) -> int:
    return int(round(amount * 100))


async def razorpay_create_order(total: float, receipt: str) -> dict:
    auth = base64.b64encode(f"{RAZORPAY_KEY_ID}:{RAZORPAY_KEY_SECRET}".encode()).decode()
    try:
        async with httpx.AsyncClient(timeout=15) as http:
            r = await http.post("https://api.razorpay.com/v1/orders",
                                headers={"Authorization": f"Basic {auth}"},
                                json={"amount": rupees_to_paise(total), "currency": "INR", "receipt": receipt})
    except httpx.HTTPError:
        logger.exception("Razorpay unreachable")
        raise HTTPException(status_code=502, detail="Couldn't reach the payment provider. Please try again or choose cash on delivery.")
    if r.status_code >= 300:
        logger.error(f"Razorpay order create failed: {r.status_code} {r.text[:300]}")
        raise HTTPException(status_code=502, detail="The payment provider rejected the request. Please try again or choose cash on delivery.")
    return r.json()


def valid_signature(message: str, signature: str, secret: str) -> bool:
    expected = hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature or "")


async def mark_paid(order: dict, payment_id: str, via: str):
    if order["payment_status"] == "paid":
        return
    ts = now_iso()
    await db.orders.update_one({"id": order["id"]}, {
        "$set": {"payment_status": "paid", "razorpay_payment_id": payment_id, "paid_at": ts, "updated_at": ts},
        "$push": {"history": {"status": "pending", "at": ts, "by": f"payment confirmed ({via})"}},
    })
    logger.info(f"Order {order['number']} paid via Razorpay ({via}) {payment_id}")


class VerifyPaymentInput(BaseModel):
    razorpay_order_id: str = Field(min_length=1, max_length=100)
    razorpay_payment_id: str = Field(min_length=1, max_length=100)
    razorpay_signature: str = Field(min_length=1, max_length=200)


@api_router.get("/payments/config")
async def payments_config():
    return {"razorpay_enabled": razorpay_enabled(), "key_id": RAZORPAY_KEY_ID if razorpay_enabled() else None}


@api_router.post("/orders/{order_id}/verify-payment")
async def verify_payment(order_id: str, input_data: VerifyPaymentInput):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order or order.get("razorpay_order_id") != input_data.razorpay_order_id:
        raise HTTPException(status_code=404, detail="Order not found")
    if not valid_signature(f"{input_data.razorpay_order_id}|{input_data.razorpay_payment_id}", input_data.razorpay_signature, RAZORPAY_KEY_SECRET):
        logger.warning(f"Bad Razorpay signature for order {order['number']}")
        raise HTTPException(status_code=400, detail="We couldn't verify this payment. If money was deducted, it will be refunded automatically. Please contact us.")
    if order["status"] == "cancelled":
        raise HTTPException(status_code=409, detail="This order was cancelled before payment completed. Please contact us for a refund.")
    await mark_paid(order, input_data.razorpay_payment_id, "checkout")
    return await db.orders.find_one({"id": order_id}, {"_id": 0})


@api_router.post("/orders/{order_id}/payment-cancelled")
async def payment_cancelled(order_id: str):
    """Customer closed the payment window: release the stock held for an unpaid online order."""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order or order["payment_method"] != "razorpay":
        raise HTTPException(status_code=404, detail="Order not found")
    if order["payment_status"] == "paid" or order["status"] == "cancelled":
        return {"status": order["status"], "payment_status": order["payment_status"]}
    ts = now_iso()
    await restock(order["items"])
    await db.orders.update_one({"id": order_id}, {"$set": {"status": "cancelled", "updated_at": ts},
                                                  "$push": {"history": {"status": "cancelled", "at": ts, "by": "payment not completed"}}})
    return {"status": "cancelled", "payment_status": "unpaid"}


@api_router.post("/payments/razorpay/webhook")
async def razorpay_webhook(request: Request):
    """Backup for customers who pay but close the tab before the browser can confirm."""
    body = await request.body()
    if not RAZORPAY_WEBHOOK_SECRET or not valid_signature(body.decode(), request.headers.get("X-Razorpay-Signature", ""), RAZORPAY_WEBHOOK_SECRET):
        raise HTTPException(status_code=400, detail="Invalid signature")
    event = json.loads(body)
    if event.get("event") in ("payment.captured", "order.paid"):
        payment = event.get("payload", {}).get("payment", {}).get("entity", {})
        order = await db.orders.find_one({"razorpay_order_id": payment.get("order_id")}, {"_id": 0})
        if order:
            await mark_paid(order, payment.get("id", ""), "webhook")
    return {"ok": True}


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


@api_router.get("/health")
async def health():
    """Configuration check for deployments. Reports only whether settings exist, never their values."""
    return {
        "database": DB_BACKEND,
        "image_storage": "supabase" if USE_SUPABASE_STORAGE else "local-disk",
        "jwt_secret_set": bool(os.environ.get("JWT_SECRET", "").strip()), "google_sign_in": bool(GOOGLE_CLIENT_ID), "nimbus_connected": nimbus_enabled(),
        "admin_password_set": bool(os.environ.get("ADMIN_PASSWORD")),
        "razorpay_enabled": razorpay_enabled(),
        "cookie_secure": COOKIE_SECURE,
        "on_vercel": bool(os.environ.get("VERCEL")),
    }


@api_router.get("/")
async def root():
    return {"message": "Aurevia API"}


app.include_router(api_router)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

_cors_host = contextvars.ContextVar("cors_host", default="")


class SiteCORSMiddleware(CORSMiddleware):
    """Also allows the site's own domain when the API is reached at api.<domain>.

    Used when the shop's files are hosted elsewhere (e.g. Hostinger at aurevia.in) and call this backend at
    api.aurevia.in. Same registrable domain, so the auth cookies stay first-party, including on Safari.
    """

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            # The real Host (not X-Forwarded-Host, which a client can set). Decided per request, never cached.
            host = next((v.decode("latin-1") for k, v in scope["headers"] if k == b"host"), "")
            _cors_host.set(host.split(":")[0].strip().lower())
        await super().__call__(scope, receive, send)

    def is_allowed_origin(self, origin: str) -> bool:
        host = _cors_host.get()
        if host.startswith("api.") and origin.lower() in (f"https://{host[4:]}", f"https://www.{host[4:]}"):
            return True
        return super().is_allowed_origin(origin)


app.add_middleware(
    SiteCORSMiddleware,
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
            ("Jewellery that says it for you", "Anti-tarnish, skin-friendly pieces from ₹449", "Shop Now", "/shop"),
            ("The Festive Edit", "Statement AD pendant sets for weddings, sangeet and celebrations", "Explore Necklaces", "/shop?category=Necklaces"),
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
                 discount_type="percent", discount_value=10, min_order=499, image=media["popup"], cta_text="Start Shopping", cta_link="/shop", show_popup=True, show_banner=True),
            dict(title="Flat ₹200 off on gift boxes & more", description="On orders above ₹1,999 with code GIFT200, made for festive gifting.", code="GIFT200",
                 discount_type="flat", discount_value=200, min_order=1999, image=media["gift_banner"], cta_text="Shop Gift Boxes", cta_link="/shop?category=Gift%20Boxes", show_popup=False, show_banner=True, ends_at=(now_utc() + timedelta(days=5)).isoformat()),
        ]
        await db.offers.insert_many([{**o, "id": uuid.uuid4().hex, "active": True, "position": i, "created_at": ts} for i, o in enumerate(offers)])


async def migrate_coupons():
    # Coupons used to live on offers. Give each offer code its own coupon once, with the same rules.
    if await db.coupons.count_documents({}):
        return
    ts = now_iso()
    async for o in db.offers.find({"code": {"$ne": ""}}, {"_id": 0}):
        if not o.get("code") or o.get("discount_type") not in ("percent", "flat") or await db.coupons.find_one({"code": o["code"]}, {"_id": 1}):
            continue
        welcome = o["code"].startswith("WELCOME")
        await db.coupons.insert_one({
            "id": uuid.uuid4().hex, "code": o["code"], "description": o.get("title", ""),
            "discount_type": o["discount_type"], "discount_value": o["discount_value"], "max_discount": 0,
            "min_order": o.get("min_order", 0), "starts_at": None, "ends_at": o.get("ends_at"),
            "usage_limit": 0, "per_customer_limit": 1 if welcome else 0, "first_order_only": welcome,
            "show_in_cart": True, "terms": "", "active": o.get("active", True), "created_at": ts, "updated_at": ts,
        })
        logger.info(f"Created coupon {o['code']} from its offer")


@app.on_event("startup")
async def startup():
    if DB_BACKEND == "postgres":
        await db.connect()
    await db.users.create_index("email", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier")
    await db.newsletter.create_index("email", unique=True)
    await db.products.create_index("id", unique=True)
    await db.orders.create_index("id", unique=True)
    await db.orders.create_index("number", unique=True)
    await db.coupons.create_index("code", unique=True)
    await seed_admin()
    await seed_products()
    await seed_storefront()
    await migrate_coupons()
    await migrate_messages()


@app.on_event("shutdown")
async def shutdown_db_client():
    if DB_BACKEND == "postgres":
        await db.close()
    elif client:
        client.close()
