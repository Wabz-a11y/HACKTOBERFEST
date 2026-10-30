from datetime import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from backend.core.security import get_current_user_token_payload
from backend.agent.tools.summary_tool import write_summary

router = APIRouter(prefix="/doctors", tags=["Doctors"])


@router.get("/patients")
async def get_doctor_patient_roster(token_payload: dict = Depends(get_current_user_token_payload)):
    return [
        {
            "id": "p_001",
            "full_name": "Sarah Wanjiku",
            "age": 68,
            "gender": "Female",
            "primary_diagnosis": "Type 2 Diabetes Mellitus / Essential Hypertension",
            "active_medications_count": 2,
            "adherence_percentage": 88.5,
            "risk_level": "Low",
            "last_review": "2026-10-24",
            "flagged_issues": "None"
        },
        {
            "id": "p_002",
            "full_name": "David Mwangi",
            "age": 74,
            "gender": "Male",
            "primary_diagnosis": "Post-Stroke Rehabilitation, Atrial Fibrillation",
            "active_medications_count": 3,
            "adherence_percentage": 65.0,
            "risk_level": "Moderate",
            "last_review": "2026-10-18",
            "flagged_issues": "Missed anticoagulant evening dose 2 days ago"
        },
        {
            "id": "p_003",
            "full_name": "Mary Achieng",
            "age": 52,
            "gender": "Female",
            "primary_diagnosis": "Severe Asthma, Bronchitis",
            "active_medications_count": 2,
            "adherence_percentage": 94.0,
            "risk_level": "Low",
            "last_review": "2026-10-29",
            "flagged_issues": "Stable"
        }
    ]


@router.get("/patients/{patient_id}/summary")
async def get_patient_summary(patient_id: str, token_payload: dict = Depends(get_current_user_token_payload)):
    if patient_id == "p_002":
        return write_summary(
            patient_id=patient_id,
            adherence_rate=65.0,
            recent_symptoms="Mild morning dizziness after waking up. Caregiver reported 1 missed evening dose.",
            clinical_notes="Patient is displaying sporadic evening non-adherence. Advise caregiver to link pill dispenser."
        )
    return write_summary(
        patient_id=patient_id,
        adherence_rate=88.5,
        recent_symptoms="Patient reported feeling well. No GI discomfort noted with Metformin.",
        clinical_notes="Therapy is currently well tolerated. Blood pressure within target range at last home check."
    )

