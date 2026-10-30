from datetime import datetime
import uuid
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from backend.models.prescription import PrescriptionCreate, PrescriptionResponse, MedicationItem
from backend.core.security import get_current_user_token_payload
from backend.agent.tools.prescription import parse_prescription

router = APIRouter(prefix="/prescriptions", tags=["Prescriptions"])

_MEM_PRESCRIPTIONS: List[dict] = []


@router.get("", response_model=List[PrescriptionResponse])
async def list_prescriptions(token_payload: dict = Depends(get_current_user_token_payload)):
    user_id = token_payload.get("sub")
    role = token_payload.get("role")
    if role == "doctor":
        return [PrescriptionResponse(**p) for p in _MEM_PRESCRIPTIONS]
    return [PrescriptionResponse(**p) for p in _MEM_PRESCRIPTIONS if p["patient_id"] == user_id]


@router.post("", response_model=PrescriptionResponse)
async def create_prescription(rx_in: PrescriptionCreate, token_payload: dict = Depends(get_current_user_token_payload)):
    new_id = f"rx_{uuid.uuid4().hex[:6]}"
    doc = {
        **rx_in.model_dump(),
        "id": new_id,
        "created_at": datetime.utcnow(),
        "verified": True
    }
    _MEM_PRESCRIPTIONS.append(doc)
    return PrescriptionResponse(**doc)


@router.post("/parse-text")
async def parse_prescription_text(payload: dict):
    text = payload.get("text", "")
    parsed = parse_prescription(text)
    return parsed

