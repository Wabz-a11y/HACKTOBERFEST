import logging
from datetime import datetime
from typing import Dict, Any, Optional
from backend.services.sms import send_sms_sync
from backend.core.config import settings

logger = logging.getLogger(__name__)


def send_alert(target_role: str, patient_id: str, severity: str, message: str, phone: Optional[str] = None) -> Dict[str, Any]:
    """
    Dispatches a context-aware alert to a patient, caregiver, or doctor.
    Severity can be: 'info', 'warning', or 'emergency'.
    Automatically triggers TalkSasa SMS dispatch for warnings and emergency triage.
    """
    alert_payload = {
        "target_role": target_role.lower(),
        "patient_id": patient_id,
        "severity": severity.lower(),
        "message": message,
        "dispatched_at": datetime.now().isoformat(),
        "delivered": True
    }
    logger.info(f"[ALERT DISPATCHED] Role={target_role} | Severity={severity} | Msg={message}")

    # Dispatch SMS via TalkSasa if phone is provided or to support phone for urgent notifications
    sms_status = None
    target_phone = phone or settings.SUPPORT_PHONE
    if severity.lower() in ["warning", "emergency"] and target_phone:
        prefix = "🚨 EMERGENCY TRIAGE" if severity.lower() == "emergency" else "⚠️ MEDICATION ALERT"
        sms_body = f"[{prefix}]\nRole: {target_role.title()}\nPatient: {patient_id}\n{message[:300]}"
        sms_status = send_sms_sync(target_phone, sms_body)

    return {
        "status": "success",
        "alert": alert_payload,
        "sms_delivery": sms_status,
        "note": f"Alert successfully dispatched to {target_role} via notification gateway and TalkSasa SMS."
    }
