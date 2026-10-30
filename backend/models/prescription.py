from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime


class MedicationItem(BaseModel):
    drug_name: str
    dosage: str  # e.g., "500mg"
    frequency: str  # e.g., "Twice daily", "Every 8 hours"
    times: List[str] = []  # e.g., ["08:00", "20:00"]
    duration_days: Optional[int] = 14
    instructions: Optional[str] = "Take with food"
    warnings: Optional[str] = "Avoid alcohol"


class PrescriptionCreate(BaseModel):
    patient_id: str
    doctor_id: Optional[str] = None
    source: str = "manual"  # "camera", "text_prompt", "doctor_issued"
    raw_text: Optional[str] = None
    image_url: Optional[str] = None
    medications: List[MedicationItem] = []
    notes: Optional[str] = None


class PrescriptionResponse(PrescriptionCreate):
    id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    verified: bool = True

