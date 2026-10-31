from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime


class UserRole(str, Enum):
    PATIENT = "patient"
    CAREGIVER = "caregiver"
    DOCTOR = "doctor"


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole
    phone: Optional[str] = None
    profile_picture: Optional[str] = None
    notifications_enabled: bool = True


class UserCreate(UserBase):
    password: str = Field(min_length=6)
    # Optional links
    caregiver_id: Optional[str] = None
    doctor_id: Optional[str] = None
    emergency_contact: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserResponse(UserBase):
    id: str
    caregiver_id: Optional[str] = None
    doctor_id: Optional[str] = None
    emergency_contact: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class UserInDB(UserBase):
    id: str
    hashed_password: str
    caregiver_id: Optional[str] = None
    doctor_id: Optional[str] = None
    emergency_contact: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    emergency_contact: Optional[str] = None
    profile_picture: Optional[str] = None
    notifications_enabled: Optional[bool] = None


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)
