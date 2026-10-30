from datetime import datetime, timedelta
import uuid
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from backend.models.reminder import ReminderCreate, ReminderResponse, ReminderStatus, ReminderUpdate
from backend.core.security import get_current_user_token_payload

router = APIRouter(prefix="/reminders", tags=["Reminders"])

_MEM_REMINDERS: List[dict] = [
    {
        "id": "rem_001",
        "patient_id": "p_001",
        "prescription_id": "rx_001",
        "medication_name": "Amoxicillin",
        "dosage": "500mg",
        "scheduled_time": datetime.utcnow().replace(hour=8, minute=0, second=0),
        "instructions": "Take with a full glass of water",
        "status": ReminderStatus.TAKEN.value,
        "taken_at": datetime.utcnow().replace(hour=8, minute=5, second=0),
        "created_at": datetime.utcnow()
    },
    {
        "id": "rem_002",
        "patient_id": "p_001",
        "prescription_id": "rx_001",
        "medication_name": "Metformin",
        "dosage": "500mg",
        "scheduled_time": datetime.utcnow().replace(hour=8, minute=0, second=0),
        "instructions": "Take with food",
        "status": ReminderStatus.TAKEN.value,
        "taken_at": datetime.utcnow().replace(hour=8, minute=6, second=0),
        "created_at": datetime.utcnow()
    },
    {
        "id": "rem_003",
        "patient_id": "p_001",
        "prescription_id": "rx_001",
        "medication_name": "Amoxicillin",
        "dosage": "500mg",
        "scheduled_time": datetime.utcnow().replace(hour=14, minute=0, second=0),
        "instructions": "Take with a full glass of water",
        "status": ReminderStatus.PENDING.value,
        "taken_at": None,
        "created_at": datetime.utcnow()
    },
    {
        "id": "rem_004",
        "patient_id": "p_001",
        "prescription_id": "rx_001",
        "medication_name": "Metformin",
        "dosage": "500mg",
        "scheduled_time": datetime.utcnow().replace(hour=20, minute=0, second=0),
        "instructions": "Take with dinner",
        "status": ReminderStatus.PENDING.value,
        "taken_at": None,
        "created_at": datetime.utcnow()
    }
]


@router.get("", response_model=List[ReminderResponse])
async def list_reminders(patient_id: Optional[str] = None, token_payload: dict = Depends(get_current_user_token_payload)):
    user_id = token_payload.get("sub")
    role = token_payload.get("role")
    
    target_id = patient_id if (role in ["caregiver", "doctor"] and patient_id) else user_id
    results = [r for r in _MEM_REMINDERS if r["patient_id"] == target_id]
    return [ReminderResponse(**r) for r in results]


@router.post("", response_model=ReminderResponse)
async def create_reminder(rem_in: ReminderCreate, token_payload: dict = Depends(get_current_user_token_payload)):
    new_id = f"rem_{uuid.uuid4().hex[:6]}"
    doc = {
        **rem_in.model_dump(),
        "id": new_id,
        "taken_at": None,
        "created_at": datetime.utcnow()
    }
    _MEM_REMINDERS.append(doc)
    return ReminderResponse(**doc)


@router.patch("/{reminder_id}/status", response_model=ReminderResponse)
async def update_reminder_status(reminder_id: str, update: ReminderUpdate):
    for r in _MEM_REMINDERS:
        if r["id"] == reminder_id:
            r["status"] = update.status.value
            if update.status == ReminderStatus.TAKEN:
                r["taken_at"] = datetime.utcnow()
            return ReminderResponse(**r)
    raise HTTPException(status_code=404, detail="Reminder not found.")


@router.post("/{reminder_id}/snooze", response_model=ReminderResponse)
async def snooze_reminder(reminder_id: str, minutes: int = 15):
    for r in _MEM_REMINDERS:
        if r["id"] == reminder_id:
            r["status"] = ReminderStatus.SNOOZED.value
            r["scheduled_time"] = datetime.utcnow() + timedelta(minutes=minutes)
            return ReminderResponse(**r)
    raise HTTPException(status_code=404, detail="Reminder not found.")


@router.get("/adherence-stats")
async def get_adherence_stats(patient_id: Optional[str] = None, token_payload: dict = Depends(get_current_user_token_payload)):
    target_id = patient_id or token_payload.get("sub")
    user_rems = [r for r in _MEM_REMINDERS if r["patient_id"] == target_id]
    total = len(user_rems)
    taken = len([r for r in user_rems if r["status"] == ReminderStatus.TAKEN.value])
    missed = len([r for r in user_rems if r["status"] == ReminderStatus.MISSED.value])
    pending = len([r for r in user_rems if r["status"] in [ReminderStatus.PENDING.value, ReminderStatus.SNOOZED.value]])
    
    score = (taken / total * 100) if total > 0 else 100.0
    return {
        "total": total,
        "taken": taken,
        "missed": missed,
        "pending": pending,
        "adherence_percentage": round(score, 1)
    }

