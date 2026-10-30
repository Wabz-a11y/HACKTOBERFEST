from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime


class AlertSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    EMERGENCY = "emergency"


class AlertBase(BaseModel):
    recipient_id: str
    recipient_role: str  # "patient", "caregiver", "doctor"
    patient_id: str
    patient_name: Optional[str] = "Patient"
    severity: AlertSeverity = AlertSeverity.INFO
    title: str
    message: str
    action_url: Optional[str] = None
    acknowledged: bool = False


class AlertCreate(AlertBase):
    pass


class AlertResponse(AlertBase):
    id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

