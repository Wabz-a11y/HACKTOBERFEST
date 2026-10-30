from datetime import datetime
import uuid
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from backend.models.alert import AlertCreate, AlertResponse, AlertSeverity
from backend.core.security import get_current_user_token_payload

router = APIRouter(prefix="/alerts", tags=["Alerts"])

_MEM_ALERTS: List[dict] = []


@router.get("", response_model=List[AlertResponse])
async def get_my_alerts(token_payload: dict = Depends(get_current_user_token_payload)):
    user_id = token_payload.get("sub")
    role = token_payload.get("role")
    
    # Return alerts matching recipient id or role
    alerts = [a for a in _MEM_ALERTS if a["recipient_id"] == user_id or a["recipient_role"] == role]
    return [AlertResponse(**a) for a in alerts]


@router.post("", response_model=AlertResponse)
async def create_alert(alert_in: AlertCreate):
    new_id = f"alt_{uuid.uuid4().hex[:6]}"
    doc = {
        **alert_in.model_dump(),
        "id": new_id,
        "acknowledged": False,
        "created_at": datetime.utcnow()
    }
    _MEM_ALERTS.append(doc)
    return AlertResponse(**doc)


@router.patch("/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(alert_id: str):
    for a in _MEM_ALERTS:
        if a["id"] == alert_id:
            a["acknowledged"] = True
            return AlertResponse(**a)
    raise HTTPException(status_code=404, detail="Alert not found.")

