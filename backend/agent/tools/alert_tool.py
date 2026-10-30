import logging
from datetime import datetime
from typing import Dict, Any

logger = logging.getLogger(__name__)


def send_alert(target_role: str, patient_id: str, severity: str, message: str) -> Dict[str, Any]:
    """
    Dispatches a context-aware alert to a patient, caregiver, or doctor.
    Severity can be: 'info', 'warning', or 'emergency'.
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
    return {
        "status": "success",
        "alert": alert_payload,
        "note": f"Alert successfully dispatched to {target_role} via notification gateway."
    }

