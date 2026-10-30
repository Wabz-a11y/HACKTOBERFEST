from datetime import datetime
import uuid
from fastapi import APIRouter, HTTPException, status, Depends
from typing import Dict, Any, List
from backend.models.user import UserCreate, UserLogin, UserResponse, UserRole, TokenResponse
from backend.core.security import get_password_hash, verify_password, create_access_token, get_current_user_token_payload
from backend.core.database import get_database

router = APIRouter(prefix="/auth", tags=["Authentication"])

# In-memory store for fallback if MongoDB is not running locally during development
_MEM_USERS: Dict[str, Dict[str, Any]] = {
    "patient@medreminder.io": {
        "id": "p_001",
        "email": "patient@medreminder.io",
        "full_name": "Sarah Wanjiku",
        "role": "patient",
        "phone": "+254 712 345 678",
        "hashed_password": get_password_hash("password123"),
        "caregiver_id": "c_001",
        "doctor_id": "d_001",
        "emergency_contact": "+254 722 999 888",
        "created_at": datetime.utcnow()
    },
    "caregiver@medreminder.io": {
        "id": "c_001",
        "email": "caregiver@medreminder.io",
        "full_name": "James Kamau",
        "role": "caregiver",
        "phone": "+254 722 999 888",
        "hashed_password": get_password_hash("password123"),
        "caregiver_id": None,
        "doctor_id": None,
        "emergency_contact": None,
        "created_at": datetime.utcnow()
    },
    "doctor@medreminder.io": {
        "id": "d_001",
        "email": "doctor@medreminder.io",
        "full_name": "Dr. Angela Omondi",
        "role": "doctor",
        "phone": "+254 733 111 222",
        "hashed_password": get_password_hash("password123"),
        "caregiver_id": None,
        "doctor_id": None,
        "emergency_contact": None,
        "created_at": datetime.utcnow()
    }
}


@router.post("/register", response_model=TokenResponse)
async def register(user_in: UserCreate):
    email = user_in.email.lower()
    db = get_database()
    
    # Check if user exists
    if db is not None:
        try:
            existing = await db.users.find_one({"email": email})
            if existing:
                raise HTTPException(status_code=400, detail="A user with this email already exists.")
        except Exception:
            pass

    if email in _MEM_USERS:
        raise HTTPException(status_code=400, detail="A user with this email already exists.")

    new_id = f"u_{uuid.uuid4().hex[:8]}"
    hashed_pwd = get_password_hash(user_in.password)
    user_doc = {
        "id": new_id,
        "email": email,
        "full_name": user_in.full_name,
        "role": user_in.role.value,
        "phone": user_in.phone,
        "hashed_password": hashed_pwd,
        "caregiver_id": user_in.caregiver_id,
        "doctor_id": user_in.doctor_id,
        "emergency_contact": user_in.emergency_contact,
        "created_at": datetime.utcnow()
    }

    _MEM_USERS[email] = user_doc
    if db is not None:
        try:
            await db.users.insert_one(user_doc)
        except Exception:
            pass

    user_resp = UserResponse(**user_doc)
    token = create_access_token({"sub": new_id, "email": email, "role": user_doc["role"]})
    return TokenResponse(access_token=token, user=user_resp)


@router.post("/login", response_model=TokenResponse)
async def login(user_in: UserLogin):
    email = user_in.email.lower()
    db = get_database()
    user_doc = None

    if db is not None:
        try:
            user_doc = await db.users.find_one({"email": email})
        except Exception:
            pass

    if not user_doc:
        user_doc = _MEM_USERS.get(email)

    if not user_doc or not verify_password(user_in.password, user_doc["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    user_resp = UserResponse(**user_doc)
    token = create_access_token({"sub": user_doc["id"], "email": email, "role": user_doc["role"]})
    return TokenResponse(access_token=token, user=user_resp)


@router.get("/me", response_model=UserResponse)
async def get_me(token_payload: Dict[str, Any] = Depends(get_current_user_token_payload)):
    user_id = token_payload.get("sub")
    for doc in _MEM_USERS.values():
        if doc["id"] == user_id:
            return UserResponse(**doc)
    raise HTTPException(status_code=404, detail="User not found.")

