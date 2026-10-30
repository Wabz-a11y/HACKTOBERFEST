from datetime import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from backend.core.security import get_current_user_token_payload
from backend.core.database import get_database
from backend.agent.tools.summary_tool import write_summary

router = APIRouter(prefix="/doctors", tags=["Doctors"])


@router.get("/patients")
async def get_doctor_patient_roster(token_payload: dict = Depends(get_current_user_token_payload)):
    """
    Returns patient roster assigned to or accessible by the doctor from database.
    """
    db = get_database()
    user_id = token_payload.get("sub")
    if db is not None:
        try:
            cursor = db["users"].find({"$or": [{"doctor_id": user_id}, {"role": "patient"}]})
            patients = await cursor.to_list(length=100)
            result = []
            for p in patients:
                result.append({
                    "id": p.get("id", str(p.get("_id", ""))),
                    "full_name": p.get("full_name", "Patient"),
                    "age": p.get("age", 45),
                    "gender": p.get("gender", "Unspecified"),
                    "primary_diagnosis": p.get("chronic_conditions", "Under Care"),
                    "active_medications_count": p.get("active_medications_count", 0),
                    "adherence_percentage": p.get("adherence_rate", 100.0),
                    "risk_level": "Low",
                    "last_review": datetime.utcnow().strftime("%Y-%m-%d"),
                    "flagged_issues": "None"
                })
            return result
        except Exception:
            pass
    return []


@router.get("/patients/{patient_id}/summary")
async def get_patient_summary(patient_id: str, token_payload: dict = Depends(get_current_user_token_payload)):
    return write_summary(
        patient_id=patient_id,
        adherence_rate=100.0,
        recent_symptoms="No adverse symptoms recorded.",
        clinical_notes="Patient routine monitoring ongoing."
    )
