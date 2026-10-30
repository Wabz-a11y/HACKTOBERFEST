from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime


class ReminderStatus(str, Enum):
    PENDING = "pending"
    TAKEN = "taken"
    SNOOZED = "snoozed"
    MISSED = "missed"


class ReminderBase(BaseModel):
    patient_id: str
    prescription_id: Optional[str] = None
    medication_name: str
    dosage: str
    scheduled_time: datetime
    instructions: Optional[str] = None
    status: ReminderStatus = ReminderStatus.PENDING


class ReminderCreate(ReminderBase):
    pass


class ReminderUpdate(BaseModel):
    status: ReminderStatus
    taken_at: Optional[datetime] = None
    notes: Optional[str] = None


class ReminderResponse(ReminderBase):
    id: str
    taken_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

