from datetime import datetime
import uuid
from typing import List
from fastapi import APIRouter, Depends
from backend.models.prescription import PrescriptionCreate, PrescriptionResponse
from backend.core.security import get_current_user_token_payload
from backend.core.database import get_database
from backend.agent.tools.prescription import parse_prescription

router = APIRouter(prefix="/prescriptions", tags=["Prescriptions"])

_MEM_PRESCRIPTIONS: List[dict] = []


def _normalize(doc: dict) -> dict:
    doc = dict(doc)
    doc.pop("_id", None)
    return doc


@router.get("", response_model=List[PrescriptionResponse])
async def list_prescriptions(token_payload: dict = Depends(get_current_user_token_payload)):
    user_id = token_payload.get("sub")
    role = token_payload.get("role")

    database = get_database()
    if database is not None:
        query = {} if role == "doctor" else {"patient_id": user_id}
        cursor = database.prescriptions.find(query).sort("created_at", -1)
        docs = await cursor.to_list(length=100)
        return [PrescriptionResponse(**_normalize(d)) for d in docs]

    if role == "doctor":
        return [PrescriptionResponse(**p) for p in _MEM_PRESCRIPTIONS]
    return [PrescriptionResponse(**p) for p in _MEM_PRESCRIPTIONS if p["patient_id"] == user_id]


@router.post("", response_model=PrescriptionResponse)
async def create_prescription(
    rx_in: PrescriptionCreate,
    token_payload: dict = Depends(get_current_user_token_payload),
):
    new_id = f"rx_{uuid.uuid4().hex[:8]}"
    doc = {
        **rx_in.model_dump(),
        "id": new_id,
        "created_at": datetime.utcnow(),
        "verified": True,
    }

    database = get_database()
    if database is not None:
        await database.prescriptions.insert_one(doc)
        return PrescriptionResponse(**_normalize(doc))

    _MEM_PRESCRIPTIONS.append(doc)
    return PrescriptionResponse(**doc)


@router.post("/parse-text")
async def parse_prescription_text(payload: dict):
    text = payload.get("text", "")
    return parse_prescription(text)
