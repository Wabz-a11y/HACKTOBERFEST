from datetime import datetime, timedelta
import uuid
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from backend.models.reminder import ReminderCreate, ReminderResponse, ReminderStatus, ReminderUpdate
from backend.core.security import get_current_user_token_payload
from backend.core.database import get_database

router = APIRouter(prefix="/reminders", tags=["Reminders"])

# In-memory fallback list (used when MongoDB is unavailable)
_MEM_REMINDERS: List[dict] = []


def _mem_find(reminder_id: str) -> dict | None:
    return next((r for r in _MEM_REMINDERS if r["id"] == reminder_id), None)


@router.get("", response_model=List[ReminderResponse])
async def list_reminders(
    patient_id: Optional[str] = None,
    token_payload: dict = Depends(get_current_user_token_payload),
):
    user_id = token_payload.get("sub")
    role = token_payload.get("role")
    target_id = patient_id if (role in ["caregiver", "doctor"] and patient_id) else user_id

    database = get_database()
    if database is not None:
        cursor = database.reminders.find({"patient_id": target_id}).sort("scheduled_time", 1)
        docs = await cursor.to_list(length=200)
        return [ReminderResponse(**_normalize(d)) for d in docs]

    results = [r for r in _MEM_REMINDERS if r["patient_id"] == target_id]
    return [ReminderResponse(**r) for r in results]


@router.post("", response_model=ReminderResponse)
async def create_reminder(
    rem_in: ReminderCreate,
    token_payload: dict = Depends(get_current_user_token_payload),
):
    new_id = f"rem_{uuid.uuid4().hex[:8]}"
    doc = {
        **rem_in.model_dump(),
        "id": new_id,
        "taken_at": None,
        "created_at": datetime.utcnow(),
    }

    database = get_database()
    if database is not None:
        await database.reminders.insert_one(doc)
        return ReminderResponse(**_normalize(doc))

    _MEM_REMINDERS.append(doc)
    return ReminderResponse(**doc)


@router.patch("/{reminder_id}/status", response_model=ReminderResponse)
async def update_reminder_status(
    reminder_id: str,
    update: ReminderUpdate,
    token_payload: dict = Depends(get_current_user_token_payload),
):
    database = get_database()
    new_status = update.status.value
    taken_at = datetime.utcnow() if update.status == ReminderStatus.TAKEN else None

    if database is not None:
        result = await database.reminders.find_one_and_update(
            {"id": reminder_id},
            {"$set": {"status": new_status, "taken_at": taken_at}},
            return_document=True,
        )
        if result:
            return ReminderResponse(**_normalize(result))
        raise HTTPException(status_code=404, detail="Reminder not found.")

    r = _mem_find(reminder_id)
    if not r:
        raise HTTPException(status_code=404, detail="Reminder not found.")
    r["status"] = new_status
    r["taken_at"] = taken_at
    return ReminderResponse(**r)


@router.post("/{reminder_id}/snooze", response_model=ReminderResponse)
async def snooze_reminder(
    reminder_id: str,
    minutes: int = 15,
    token_payload: dict = Depends(get_current_user_token_payload),
):
    new_time = datetime.utcnow() + timedelta(minutes=minutes)
    new_status = ReminderStatus.SNOOZED.value

    database = get_database()
    if database is not None:
        result = await database.reminders.find_one_and_update(
            {"id": reminder_id},
            {"$set": {"status": new_status, "scheduled_time": new_time}},
            return_document=True,
        )
        if result:
            return ReminderResponse(**_normalize(result))
        raise HTTPException(status_code=404, detail="Reminder not found.")

    r = _mem_find(reminder_id)
    if not r:
        raise HTTPException(status_code=404, detail="Reminder not found.")
    r["status"] = new_status
    r["scheduled_time"] = new_time
    return ReminderResponse(**r)


@router.get("/adherence-stats")
async def get_adherence_stats(
    patient_id: Optional[str] = None,
    token_payload: dict = Depends(get_current_user_token_payload),
):
    target_id = patient_id or token_payload.get("sub")

    database = get_database()
    if database is not None:
        cursor = database.reminders.find({"patient_id": target_id})
        docs = await cursor.to_list(length=500)
    else:
        docs = [r for r in _MEM_REMINDERS if r["patient_id"] == target_id]

    total = len(docs)
    taken = sum(1 for r in docs if r.get("status") == ReminderStatus.TAKEN.value)
    missed = sum(1 for r in docs if r.get("status") == ReminderStatus.MISSED.value)
    pending = sum(1 for r in docs if r.get("status") in [ReminderStatus.PENDING.value, ReminderStatus.SNOOZED.value])
    score = round(taken / total * 100, 1) if total > 0 else 100.0

    return {
        "total": total,
        "taken": taken,
        "missed": missed,
        "pending": pending,
        "adherence_percentage": score,
    }


def _normalize(doc: dict) -> dict:
    """Strip MongoDB _id so Pydantic doesn't choke on it."""
    doc = dict(doc)
    doc.pop("_id", None)
    return doc
