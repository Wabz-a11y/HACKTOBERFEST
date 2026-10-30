from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from backend.core.security import get_current_user_token_payload
from backend.routers.reminders import _MEM_REMINDERS
from backend.routers.alerts import _MEM_ALERTS

router = APIRouter(prefix="/caregivers", tags=["Caregivers"])


@router.get("/patients")
async def get_monitored_patients(token_payload: dict = Depends(get_current_user_token_payload)):
    # Returns patient dependents under the logged-in caregiver
    return [
        {
            "id": "p_001",
            "full_name": "Sarah Wanjiku",
            "relationship": "Mother",
            "age": 68,
            "chronic_conditions": "Type 2 Diabetes, Hypertension",
            "allergies": "Penicillin (Mild)",
            "phone": "+254 712 345 678",
            "adherence_rate": 88.5,
            "today_pending_doses": 2,
            "today_taken_doses": 2,
            "status": "stable"
        },
        {
            "id": "p_002",
            "full_name": "David Mwangi",
            "relationship": "Uncle",
            "age": 74,
            "chronic_conditions": "Post-Stroke Recovery, Atrial Fibrillation",
            "allergies": "None",
            "phone": "+254 721 987 654",
            "adherence_rate": 65.0,
            "today_pending_doses": 1,
            "today_taken_doses": 1,
            "status": "attention_required"
        }
    ]


@router.get("/dashboard-feed")
async def get_caregiver_feed(token_payload: dict = Depends(get_current_user_token_payload)):
    user_id = token_payload.get("sub")
    caregiver_alerts = [a for a in _MEM_ALERTS if a["recipient_role"] == "caregiver" or a["recipient_id"] == user_id]
    return {
        "active_dependents_count": 2,
        "unread_alerts_count": len([a for a in caregiver_alerts if not a.get("acknowledged")]),
        "recent_alerts": caregiver_alerts[-5:],
        "overall_adherence_index": 76.8
    }

