from datetime import datetime
import uuid
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
from backend.models.user import UserCreate, UserLogin, UserResponse, TokenResponse
from backend.core.security import get_password_hash, verify_password, create_access_token, get_current_user_token_payload, rehash_if_needed
from backend.core.database import get_database

router = APIRouter(prefix="/auth", tags=["Authentication"])

# In-memory fallback (only used when MongoDB is unavailable)
_MEM_USERS: Dict[str, Dict[str, Any]] = {
    "patient@medreminder.io": {
        "id": "p_001",
        "email": "patient@medreminder.io",
        "full_name": "Demo Patient",
        "role": "patient",
        "phone": "+254700000001",
        "hashed_password": get_password_hash("password123"),
        "caregiver_id": "c_001",
        "doctor_id": "d_001",
        "emergency_contact": "+254700000099",
        "created_at": datetime.utcnow(),
    },
    "caregiver@medreminder.io": {
        "id": "c_001",
        "email": "caregiver@medreminder.io",
        "full_name": "Demo Caregiver",
        "role": "caregiver",
        "phone": "+254700000002",
        "hashed_password": get_password_hash("password123"),
        "caregiver_id": None,
        "doctor_id": None,
        "emergency_contact": None,
        "created_at": datetime.utcnow(),
    },
    "doctor@medreminder.io": {
        "id": "d_001",
        "email": "doctor@medreminder.io",
        "full_name": "Dr. Demo Doctor",
        "role": "doctor",
        "phone": "+254700000003",
        "hashed_password": get_password_hash("password123"),
        "caregiver_id": None,
        "doctor_id": None,
        "emergency_contact": None,
        "created_at": datetime.utcnow(),
    },
}


def _mem_find_user_by_email(email: str) -> Dict | None:
    return _MEM_USERS.get(email.lower())


def _mem_find_user_by_id(user_id: str) -> Dict | None:
    for doc in _MEM_USERS.values():
        if doc["id"] == user_id:
            return doc
    return None


@router.post("/register", response_model=TokenResponse)
async def register(user_in: UserCreate):
    email = user_in.email.lower()
    database = get_database()

    # --- MongoDB path ---
    if database is not None:
        existing = await database.users.find_one({"email": email})
        if existing:
            raise HTTPException(status_code=400, detail="A user with this email already exists.")

        new_id = f"u_{uuid.uuid4().hex[:8]}"
        hashed_pwd = get_password_hash(user_in.password)
        user_doc = {
            "id": new_id,
            "email": email,
            "full_name": user_in.full_name,
            "role": user_in.role.value,
            "phone": user_in.phone or "",
            "hashed_password": hashed_pwd,
            "caregiver_id": user_in.caregiver_id,
            "doctor_id": user_in.doctor_id,
            "emergency_contact": user_in.emergency_contact,
            "created_at": datetime.utcnow(),
        }
        await database.users.insert_one(user_doc)
        token = create_access_token({"sub": new_id, "email": email, "role": user_doc["role"]})
        return TokenResponse(access_token=token, user=UserResponse(**user_doc))

    # --- In-memory fallback ---
    if email in _MEM_USERS:
        raise HTTPException(status_code=400, detail="A user with this email already exists.")
    new_id = f"u_{uuid.uuid4().hex[:8]}"
    hashed_pwd = get_password_hash(user_in.password)
    user_doc = {
        "id": new_id,
        "email": email,
        "full_name": user_in.full_name,
        "role": user_in.role.value,
        "phone": user_in.phone or "",
        "hashed_password": hashed_pwd,
        "caregiver_id": user_in.caregiver_id,
        "doctor_id": user_in.doctor_id,
        "emergency_contact": user_in.emergency_contact,
        "created_at": datetime.utcnow(),
    }
    _MEM_USERS[email] = user_doc
    token = create_access_token({"sub": new_id, "email": email, "role": user_doc["role"]})
    return TokenResponse(access_token=token, user=UserResponse(**user_doc))


@router.post("/login", response_model=TokenResponse)
async def login(user_in: UserLogin):
    email = user_in.email.lower()
    database = get_database()
    user_doc = None

    # --- MongoDB path ---
    if database is not None:
        user_doc = await database.users.find_one({"email": email})

    # --- In-memory fallback ---
    if not user_doc:
        user_doc = _MEM_USERS.get(email)

    if not user_doc or not verify_password(user_in.password, user_doc["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    # Transparent Argon2id upgrade: if the stored hash is legacy PBKDF2, re-hash on login
    new_hash = rehash_if_needed(user_in.password, user_doc["hashed_password"])
    if new_hash:
        if database is not None:
            await database.users.update_one({"id": user_doc["id"]}, {"$set": {"hashed_password": new_hash}})
        else:
            _MEM_USERS[email]["hashed_password"] = new_hash

    token = create_access_token({"sub": user_doc["id"], "email": email, "role": user_doc["role"]})
    return TokenResponse(access_token=token, user=UserResponse(**user_doc))


@router.get("/me", response_model=UserResponse)
async def get_me(token_payload: Dict[str, Any] = Depends(get_current_user_token_payload)):
    user_id = token_payload.get("sub")
    database = get_database()

    # --- MongoDB path ---
    if database is not None:
        doc = await database.users.find_one({"id": user_id})
        if doc:
            return UserResponse(**doc)

    # --- In-memory fallback ---
    doc = _mem_find_user_by_id(user_id)
    if doc:
        return UserResponse(**doc)

    raise HTTPException(status_code=404, detail="User not found.")
