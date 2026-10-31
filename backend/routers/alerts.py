from datetime import datetime
import uuid
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from backend.models.alert import AlertCreate, AlertResponse
from backend.core.security import get_current_user_token_payload
from backend.core.database import get_database

router = APIRouter(prefix="/alerts", tags=["Alerts"])

_MEM_ALERTS: List[dict] = []


def _normalize(doc: dict) -> dict:
    doc = dict(doc)
    doc.pop("_id", None)
    return doc


@router.get("", response_model=List[AlertResponse])
async def get_my_alerts(token_payload: dict = Depends(get_current_user_token_payload)):
    user_id = token_payload.get("sub")
    role = token_payload.get("role")

    database = get_database()
    if database is not None:
        cursor = database.alerts.find(
            {"$or": [{"recipient_id": user_id}, {"recipient_role": role}]}
        ).sort("created_at", -1).limit(50)
        docs = await cursor.to_list(length=50)
        return [AlertResponse(**_normalize(d)) for d in docs]

    alerts = [
        a for a in _MEM_ALERTS
        if a.get("recipient_id") == user_id or a.get("recipient_role") == role
    ]
    return [AlertResponse(**a) for a in reversed(alerts)]


@router.post("", response_model=AlertResponse)
async def create_alert(alert_in: AlertCreate):
    new_id = f"alt_{uuid.uuid4().hex[:8]}"
    doc = {
        **alert_in.model_dump(),
        "id": new_id,
        "acknowledged": False,
        "created_at": datetime.utcnow(),
    }

    database = get_database()
    if database is not None:
        await database.alerts.insert_one(doc)
        return AlertResponse(**_normalize(doc))

    _MEM_ALERTS.append(doc)
    return AlertResponse(**doc)


@router.patch("/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(
    alert_id: str,
    token_payload: dict = Depends(get_current_user_token_payload),
):
    database = get_database()
    if database is not None:
        result = await database.alerts.find_one_and_update(
            {"id": alert_id},
            {"$set": {"acknowledged": True}},
            return_document=True,
        )
        if result:
            return AlertResponse(**_normalize(result))
        raise HTTPException(status_code=404, detail="Alert not found.")

    for a in _MEM_ALERTS:
        if a["id"] == alert_id:
            a["acknowledged"] = True
            return AlertResponse(**a)
    raise HTTPException(status_code=404, detail="Alert not found.")
