"""
Core security utilities for Smart Medication Reminder API.

Password hashing: Argon2id (RFC 9106 recommended variant)
  - Memory: 64 MB  (OWASP minimum for high-value credentials)
  - Iterations: 3
  - Parallelism: 4
  - Hash length: 32 bytes
  - Salt: 16 bytes (auto-generated per hash by argon2-cffi)

Token signing: HS256 JWT via python-jose
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from backend.core.config import settings

# ── Argon2id hasher (OWASP-compliant parameters) ──────────────────────────────
_ph = PasswordHasher(
    time_cost=3,        # iterations
    memory_cost=65536,  # 64 MB in KiB
    parallelism=4,
    hash_len=32,
    salt_len=16,
    encoding="utf-8",
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# ── Password helpers ─────────────────────────────────────────────────────────

def get_password_hash(password: str) -> str:
    """Hash a plaintext password with Argon2id. Returns a self-contained encoded string."""
    return _ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plaintext password against an Argon2id hash.
    Also handles legacy PBKDF2-SHA256 hex hashes (from previous security.py) so
    existing demo accounts keep working until they next log in and get re-hashed.
    """
    # ── Argon2id path ──
    if hashed_password.startswith("$argon2"):
        try:
            return _ph.verify(hashed_password, plain_password)
        except (VerifyMismatchError, VerificationError, InvalidHashError):
            return False

    # ── Legacy PBKDF2-SHA256 hex fallback ──────────────────────────────────
    # Matches hashes produced by the old hashlib.pbkdf2_hmac implementation.
    # This fallback can be removed once all users have re-authenticated.
    import hashlib, hmac
    _LEGACY_SALT = b"smart_med_salt_2026_hacktoberfest"
    try:
        legacy_hash = hashlib.pbkdf2_hmac(
            "sha256", plain_password.encode("utf-8"), _LEGACY_SALT, 100000
        ).hex()
        return hmac.compare_digest(legacy_hash, hashed_password)
    except Exception:
        return False


def rehash_if_needed(plain_password: str, stored_hash: str) -> Optional[str]:
    """
    Returns a fresh Argon2id hash when the stored hash is a legacy PBKDF2 hash,
    so callers can transparently upgrade on next login. Returns None if already Argon2id.
    """
    if stored_hash.startswith("$argon2"):
        return None  # Already modern — no upgrade needed
    return get_password_hash(plain_password)


# ── JWT helpers ───────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None


async def get_current_user_token_payload(
    token: str = Depends(oauth2_scheme),
) -> Dict[str, Any]:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None or "sub" not in payload:
        raise exc
    return payload
