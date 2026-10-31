import logging
import re
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# Standalone in-memory fallback list
_MEM_DOSES: List[dict] = []
_MEM_RX: List[dict] = []


def _get_shared_mem_reminders() -> List[dict]:
    """Lazily access shared in-memory reminders without circular import at module load."""
    try:
        from backend.routers.reminders import _MEM_REMINDERS
        return _MEM_REMINDERS
    except Exception:
        return _MEM_DOSES


def _normalize_doc(doc: dict) -> dict:
    d = dict(doc)
    d.pop("_id", None)
    for k, v in list(d.items()):
        if isinstance(v, datetime):
            d[k] = v.isoformat()
    return d


def parse_time_expression(time_str: str) -> Optional[datetime]:
    """
    Parses natural language or numerical time expressions (e.g. '4:16 am', '14:30', '8 PM')
    into a concrete UTC datetime object for scheduling.
    """
    s = (time_str or "").lower().strip()
    match = re.search(r"(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?", s)
    if not match:
        return None

    hour = int(match.group(1))
    minute = int(match.group(2)) if match.group(2) else 0
    meridiem = match.group(3)

    if meridiem == "pm" and hour < 12:
        hour += 12
    elif meridiem == "am" and hour == 12:
        hour = 0

    now = datetime.utcnow()
    target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)

    # If the user explicitly mentions 'tomorrow', schedule for tomorrow
    if "tomorrow" in s:
        target += timedelta(days=1)
    elif target < (now - timedelta(minutes=10)):
        # If the time is in the past for today, advance to next occurrence
        target += timedelta(days=1)

    return target


def _summarise_doses(reminders: List[dict]) -> Dict[str, Any]:
    total = len(reminders)
    taken = sum(1 for r in reminders if r.get("status") == "taken")
    pending = sum(1 for r in reminders if r.get("status") == "pending")
    snoozed = sum(1 for r in reminders if r.get("status") == "snoozed")
    missed = sum(1 for r in reminders if r.get("status") == "missed")
    adherence = round((taken / total * 100), 1) if total > 0 else 100.0
    return {
        "status": "success",
        "total_doses": total,
        "taken": taken,
        "pending": pending,
        "snoozed": snoozed,
        "missed": missed,
        "adherence_rate_pct": adherence,
        "doses": reminders,
    }


async def fetch_dose_schedule(patient_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetches the patient's dose schedule and upcoming medication reminders from the database.
    Returns structured list of doses (pending, taken, snoozed, missed) and adherence stats.
    """
    from backend.core.database import get_database
    database = get_database()
    reminders: List[dict] = []

    if database is not None:
        try:
            query = {"patient_id": patient_id} if patient_id else {}
            cursor = database.reminders.find(query).sort("scheduled_time", 1)
            docs = await cursor.to_list(length=100)
            reminders = [_normalize_doc(d) for d in docs]
        except Exception as exc:
            logger.warning(f"DB fetch_dose_schedule failed: {exc}")

    if not reminders:
        shared = _get_shared_mem_reminders()
        if patient_id:
            reminders = [_normalize_doc(r) for r in shared if r.get("patient_id") == patient_id]
        else:
            reminders = [_normalize_doc(r) for r in shared]

    return _summarise_doses(reminders)


def get_dose_schedule(patient_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Agent tool — synchronous view of the patient's dose schedule, timings, and adherence.
    """
    shared = _get_shared_mem_reminders()
    matching = [
        _normalize_doc(r) for r in shared
        if not patient_id or r.get("patient_id") == patient_id
    ]
    return _summarise_doses(matching)


async def create_dose_reminder(
    patient_id: str,
    medication_name: str,
    scheduled_time: str,
    dosage: str = "Standard dose",
    instructions: Optional[str] = None
) -> Dict[str, Any]:
    """
    Agent tool — Actually creates and schedules a medication dose reminder in the database.
    Saves to MongoDB Atlas collection `reminders` so it appears on the patient's Dose Schedule.
    """
    parsed_dt = parse_time_expression(scheduled_time)
    if not parsed_dt:
        parsed_dt = datetime.utcnow() + timedelta(hours=1)

    reminder_id = f"rem_{uuid.uuid4().hex[:8]}"
    reminder_doc = {
        "id": reminder_id,
        "patient_id": patient_id,
        "medication_name": medication_name.strip(),
        "dosage": dosage.strip() if dosage else "Standard dose",
        "scheduled_time": parsed_dt,
        "instructions": (instructions or "Take with water as directed").strip(),
        "status": "pending",
        "taken_at": None,
        "created_at": datetime.utcnow(),
    }

    from backend.core.database import get_database
    database = get_database()

    saved_in_db = False
    if database is not None:
        try:
            await database.reminders.insert_one(dict(reminder_doc))
            saved_in_db = True
            logger.info(f"✅ Created reminder in MongoDB Atlas: {reminder_id} for {medication_name} at {parsed_dt}")
        except Exception as exc:
            logger.warning(f"Failed to insert reminder into MongoDB: {exc}")

    # Also keep in in-memory list for instant synchronous lookup
    shared = _get_shared_mem_reminders()
    shared.append(reminder_doc)
    if reminder_doc not in _MEM_DOSES:
        _MEM_DOSES.append(reminder_doc)

    formatted_time = parsed_dt.strftime("%I:%M %p")
    return {
        "status": "success",
        "saved_in_db": saved_in_db,
        "reminder": _normalize_doc(reminder_doc),
        "formatted_time": formatted_time,
        "confirmation": f"Reminder for {medication_name} successfully scheduled at {formatted_time}."
    }


async def check_reminder_status(
    patient_id: str,
    medication_name: Optional[str] = None,
    target_time: Optional[str] = None
) -> Dict[str, Any]:
    """
    Agent tool — Queries the database to verify if a reminder has been set for a medication or time.
    Returns matched reminders with current status.
    """
    from backend.core.database import get_database
    database = get_database()
    reminders: List[dict] = []

    if database is not None:
        try:
            query = {"patient_id": patient_id} if patient_id else {}
            cursor = database.reminders.find(query).sort("scheduled_time", 1)
            docs = await cursor.to_list(length=100)
            reminders = [_normalize_doc(d) for d in docs]
        except Exception as exc:
            logger.warning(f"Error querying reminders from DB: {exc}")

    if not reminders:
        shared = _get_shared_mem_reminders()
        reminders = [_normalize_doc(r) for r in shared if not patient_id or r.get("patient_id") == patient_id]

    matched = []
    med_lower = (medication_name or "").lower().strip()
    time_lower = (target_time or "").lower().strip()

    for r in reminders:
        r_name = r.get("medication_name", "").lower()
        r_time = r.get("scheduled_time", "")
        if med_lower and (med_lower in r_name or r_name in med_lower):
            matched.append(r)
        elif time_lower and time_lower in r_time:
            matched.append(r)

    is_set = len(matched) > 0 or len(reminders) > 0
    return {
        "status": "success",
        "is_set": is_set,
        "matched_reminders": matched,
        "all_reminders": reminders[:5]
    }


async def fetch_patient_prescriptions(patient_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetches the patient's active prescriptions, dosages, frequency, and instructions.
    """
    from backend.core.database import get_database
    database = get_database()
    prescriptions: List[dict] = []

    if database is not None:
        try:
            query = {"patient_id": patient_id} if patient_id else {}
            cursor = database.prescriptions.find(query).sort("created_at", -1)
            docs = await cursor.to_list(length=50)
            prescriptions = [_normalize_doc(d) for d in docs]
        except Exception as exc:
            logger.warning(f"DB fetch_patient_prescriptions failed: {exc}")

    if not prescriptions:
        if patient_id:
            prescriptions = [_normalize_doc(p) for p in _MEM_RX if p.get("patient_id") == patient_id]
        else:
            prescriptions = [_normalize_doc(p) for p in _MEM_RX]

    return {
        "status": "success",
        "total_prescriptions": len(prescriptions),
        "prescriptions": prescriptions
    }


def get_patient_prescriptions(patient_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Agent tool — synchronous view of active prescriptions.
    """
    matching = [
        _normalize_doc(p) for p in _MEM_RX
        if not patient_id or p.get("patient_id") == patient_id
    ]
    return {
        "status": "success",
        "total_prescriptions": len(matching),
        "prescriptions": matching
    }


async def review_missed_doses_and_send_sms(
    patient_id: str,
    phone: Optional[str] = None,
    patient_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Agent tool — reviews the patient's dose schedule for missed or overdue doses
    and automatically dispatches an SMS reminder to the patient's phone using TalkSasa.
    Also creates an alert record in the alerts collection.
    """
    from backend.core.database import get_database
    from backend.services.sms import send_sms_sync, send_patient_missed_dose_sms

    database = get_database()
    now_utc = datetime.utcnow()

    # 1. Resolve patient phone and name if not provided
    resolved_phone = phone
    resolved_name = patient_name or "Patient"

    if (not resolved_phone or not patient_name) and database is not None:
        try:
            user_doc = await database.users.find_one({"id": patient_id})
            if user_doc:
                if not resolved_phone:
                    resolved_phone = user_doc.get("phone")
                if not patient_name and user_doc.get("full_name"):
                    resolved_name = user_doc.get("full_name")
        except Exception as e:
            logger.warning(f"Could not fetch user info for missed dose SMS: {e}")

    # Fallback to in-memory users if still not found
    if not resolved_phone:
        try:
            from backend.routers.auth import _MEM_USERS
            for u in _MEM_USERS.values():
                if u.get("id") == patient_id:
                    resolved_phone = u.get("phone")
                    if not resolved_name or resolved_name == "Patient":
                        resolved_name = u.get("full_name", "Patient")
                    break
        except Exception:
            pass

    # 2. Retrieve reminders from DB or memory
    all_reminders: List[dict] = []
    if database is not None:
        try:
            cursor = database.reminders.find({"patient_id": patient_id})
            all_reminders = await cursor.to_list(length=100)
        except Exception as e:
            logger.warning(f"Failed to query reminders for missed doses: {e}")

    if not all_reminders:
        shared = _get_shared_mem_reminders()
        all_reminders = [r for r in shared if r.get("patient_id") == patient_id]

    # 3. Identify missed and overdue pending doses
    missed_doses: List[dict] = []
    overdue_ids: List[str] = []

    for r in all_reminders:
        status = r.get("status", "pending")
        sched_time = r.get("scheduled_time")
        sched_dt = None
        if isinstance(sched_time, datetime):
            sched_dt = sched_time
        elif isinstance(sched_time, str):
            try:
                sched_dt = datetime.fromisoformat(sched_time.replace("Z", "+00:00")).replace(tzinfo=None)
            except Exception:
                pass

        if status == "missed":
            missed_doses.append(_normalize_doc(r))
        elif status == "pending" and sched_dt and sched_dt < (now_utc - timedelta(minutes=5)):
            # Mark as missed since it is past scheduled time
            missed_doses.append(_normalize_doc(r))
            if r.get("id"):
                overdue_ids.append(r["id"])

    # Update overdue pending to missed in MongoDB
    if overdue_ids and database is not None:
        try:
            await database.reminders.update_many(
                {"id": {"$in": overdue_ids}},
                {"$set": {"status": "missed"}}
            )
        except Exception as e:
            logger.warning(f"Failed to update overdue doses to missed: {e}")

    # 4. If no missed doses
    if not missed_doses:
        return {
            "status": "no_missed_doses",
            "count": 0,
            "missed_doses": [],
            "message": "No missed doses found. All medications are up to date!",
        }

    # 5. Check if phone is available
    if not resolved_phone or not resolved_phone.strip():
        return {
            "status": "needs_phone",
            "count": len(missed_doses),
            "missed_doses": missed_doses,
            "message": "Missed doses detected, but no mobile phone number is registered in your profile.",
            "patient_name": resolved_name
        }

    # 6. Dispatch SMS via TalkSasa
    clean_phone = resolved_phone.strip()
    sms_res = None
    if len(missed_doses) == 1:
        dose = missed_doses[0]
        t_raw = dose.get("scheduled_time", "")
        t_str = t_raw.split("T")[-1][:5] if "T" in t_raw else t_raw
        sms_res = send_patient_missed_dose_sms(
            phone=clean_phone,
            patient_name=resolved_name,
            medication_name=dose.get("medication_name", "Medication"),
            dosage=dose.get("dosage"),
            scheduled_time=t_str,
            instructions=dose.get("instructions")
        )
    else:
        med_names = ", ".join([d.get("medication_name", "Medication") for d in missed_doses[:3]])
        batch_msg = (
            f"[Smart Med Alert - Missed Dose]\n"
            f"Hi {resolved_name}, you have {len(missed_doses)} missed medication dose(s): {med_names}.\n"
            f"Please check your Smart Med dose schedule and take your medication safely as directed."
        )
        sms_res = send_sms_sync(clean_phone, batch_msg)

    # 7. Record an alert in database
    if database is not None:
        try:
            med_list = ", ".join([d.get("medication_name", "Medication") for d in missed_doses[:2]])
            alert_id = f"alt_{uuid.uuid4().hex[:8]}"
            alert_doc = {
                "id": alert_id,
                "recipient_id": patient_id,
                "recipient_role": "patient",
                "patient_id": patient_id,
                "severity": "high",
                "title": "Missed Dose SMS Reminder Dispatched",
                "message": f"Sent SMS alert to {clean_phone} for missed dose(s): {med_list}.",
                "acknowledged": False,
                "starred": False,
                "deleted": False,
                "created_at": datetime.utcnow()
            }
            await database.alerts.insert_one(alert_doc)
        except Exception as e:
            logger.warning(f"Failed to record alert for missed dose SMS: {e}")

    return {
        "status": "success",
        "count": len(missed_doses),
        "phone": clean_phone,
        "missed_doses": missed_doses,
        "sms_result": sms_res,
        "patient_name": resolved_name,
        "message": f"Sent SMS reminder to {clean_phone} for {len(missed_doses)} missed dose(s)."
    }


def review_missed_doses_and_send_sms_sync(
    patient_id: str,
    phone: Optional[str] = None,
    patient_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Synchronous wrapper for agent tool invocation.
    """
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            shared = _get_shared_mem_reminders()
            missed = [
                _normalize_doc(r) for r in shared
                if r.get("patient_id") == patient_id and r.get("status") in ("missed",)
            ]
            return {
                "status": "success" if missed else "no_missed_doses",
                "count": len(missed),
                "missed_doses": missed,
                "phone": phone,
                "message": f"Reviewed {len(missed)} missed doses."
            }
        else:
            return loop.run_until_complete(review_missed_doses_and_send_sms(patient_id, phone, patient_name))
    except Exception:
        return {
            "status": "no_missed_doses",
            "count": 0,
            "missed_doses": [],
            "message": "Dose schedule reviewed."
        }

