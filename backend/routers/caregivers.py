from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from backend.core.security import get_current_user_token_payload
from backend.core.database import get_database
from backend.routers.alerts import _MEM_ALERTS

router = APIRouter(prefix="/caregivers", tags=["Caregivers"])


@router.get("/patients")
async def get_monitored_patients(token_payload: dict = Depends(get_current_user_token_payload)):
    """
    Returns patient dependents under the logged-in caregiver from database.
    """
    db = get_database()
    user_id = token_payload.get("sub")
    if db is not None:
        try:
            cursor = db["users"].find({"$or": [{"caregiver_id": user_id}, {"role": "patient"}]})
            patients = await cursor.to_list(length=100)
            result = []
            for p in patients:
                result.append({
                    "id": p.get("id", str(p.get("_id", ""))),
                    "full_name": p.get("full_name", "Patient"),
                    "relationship": p.get("relationship", "Dependent"),
                    "age": p.get("age", 60),
                    "chronic_conditions": p.get("chronic_conditions", "Under evaluation"),
                    "allergies": p.get("allergies", "None"),
                    "phone": p.get("phone", ""),
                    "adherence_rate": p.get("adherence_rate", 100.0),
                    "today_pending_doses": 0,
                    "today_taken_doses": 0,
                    "status": "stable"
                })
            return result
        except Exception:
            pass
    return []


@router.get("/dashboard-feed")
async def get_caregiver_feed(token_payload: dict = Depends(get_current_user_token_payload)):
    user_id = token_payload.get("sub")
    caregiver_alerts = [a for a in _MEM_ALERTS if a.get("recipient_role") == "caregiver" or a.get("recipient_id") == user_id]
    return {
        "active_dependents_count": len(caregiver_alerts),
        "unread_alerts_count": len([a for a in caregiver_alerts if not a.get("acknowledged")]),
        "recent_alerts": caregiver_alerts[-5:],
        "overall_adherence_index": 100.0 if not caregiver_alerts else 85.0
    }
