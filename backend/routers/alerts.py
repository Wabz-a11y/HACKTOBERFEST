from datetime import datetime
import uuid
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from backend.models.alert import AlertCreate, AlertResponse
from backend.core.security import get_current_user_token_payload
from backend.core.database import get_database
from backend.services.notification import notification_manager

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
            {"$and": [
                {"deleted": {"$ne": True}},
                {"$or": [{"recipient_id": user_id}, {"recipient_role": role}]},
            ]}
        ).sort("created_at", -1).limit(50)
        docs = await cursor.to_list(length=50)
        return [AlertResponse(**_normalize(d)) for d in docs]

    alerts = [
        a for a in _MEM_ALERTS
        if not a.get("deleted", False)
        and (a.get("recipient_id") == user_id or a.get("recipient_role") == role)
    ]
    return [AlertResponse(**a) for a in reversed(alerts)]


@router.post("", response_model=AlertResponse)
async def create_alert(alert_in: AlertCreate):
    new_id = f"alt_{uuid.uuid4().hex[:8]}"
    doc = {
        **alert_in.model_dump(),
        "id": new_id,
        "acknowledged": False,
        "starred": False,
        "deleted": False,
        "created_at": datetime.utcnow(),
    }

    database = get_database()
    if database is not None:
        await database.alerts.insert_one(doc)
        await notification_manager.broadcast_alert(doc)
        return AlertResponse(**_normalize(doc))

    _MEM_ALERTS.append(doc)
    await notification_manager.broadcast_alert(doc)
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


@router.patch("/read-all")
async def mark_all_read(token_payload: dict = Depends(get_current_user_token_payload)):
    user_id = token_payload.get("sub")
    role = token_payload.get("role")
    selector = {"$or": [{"recipient_id": user_id}, {"recipient_role": role}]}
    database = get_database()
    if database is not None:
        await database.alerts.update_many(selector, {"$set": {"acknowledged": True}})
    else:
        for alert in _MEM_ALERTS:
            if alert.get("recipient_id") == user_id or alert.get("recipient_role") == role:
                alert["acknowledged"] = True
    return {"message": "All notifications marked as read."}


@router.patch("/{alert_id}/star", response_model=AlertResponse)
async def toggle_star(alert_id: str):
    database = get_database()
    if database is not None:
        alert = await database.alerts.find_one({"id": alert_id})
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found.")
        updated = await database.alerts.find_one_and_update(
            {"id": alert_id},
            {"$set": {"starred": not alert.get("starred", False)}},
            return_document=True,
        )
        return AlertResponse(**_normalize(updated))
    for alert in _MEM_ALERTS:
        if alert["id"] == alert_id:
            alert["starred"] = not alert.get("starred", False)
            return AlertResponse(**alert)
    raise HTTPException(status_code=404, detail="Alert not found.")


@router.delete("/{alert_id}")
async def delete_alert(alert_id: str):
    database = get_database()
    if database is not None:
        updated = await database.alerts.find_one_and_update(
            {"id": alert_id},
            {"$set": {"deleted": True}},
            return_document=True,
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Alert not found.")
        return {"message": "Notification deleted."}
    for alert in _MEM_ALERTS:
        if alert["id"] == alert_id:
            alert["deleted"] = True
            return {"message": "Notification deleted."}
    raise HTTPException(status_code=404, detail="Alert not found.")
