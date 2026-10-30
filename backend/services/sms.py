import os
import re
import logging
from typing import Dict, Any, Optional
import requests
from backend.core.config import settings

logger = logging.getLogger(__name__)


def send_sms_sync(phone: str, message: str) -> Dict[str, Any]:
    """
    Send SMS via TalkSasa API (mirrored from PORTFOLIO & HOUSEKONECT).
    Supports automatic Kenyan international dialing normalization (+254...).
    """
    api_key = settings.TALKSASA_API_KEY or os.getenv("TALKSASA_API_KEY", "")
    sender_id = settings.TALKSASA_SENDER_ID or os.getenv("TALKSASA_SENDER_ID", "TALKSASA")
    base_url = settings.TALKSASA_API_URL or os.getenv("TALKSASA_API_URL", "https://bulksms.talksasa.com/api/v3/sms/send")
    base_url = base_url.rstrip("/").removesuffix("/sms/send")
    url = f"{base_url}/sms/send"

    if not api_key:
        logger.debug(f"[TALKSASA] TALKSASA_API_KEY not configured — skipping SMS to {phone}")
        return {"success": False, "simulated": True, "message": "TALKSASA_API_KEY not configured"}

    if not sender_id:
        logger.warning("[TALKSASA] TALKSASA_SENDER_ID not configured — skipping SMS.")
        return {"success": False, "error": "TALKSASA_SENDER_ID not configured"}

    # Normalize phone: strip non-digits, ensure 254 format
    recipient = re.sub(r"[^\d]", "", phone.lstrip("+"))
    if recipient.startswith("0"):
        recipient = "254" + recipient[1:]
    elif recipient.startswith("7") or recipient.startswith("1"):
        recipient = "254" + recipient

    if not recipient or len(recipient) < 9:
        logger.warning(f"[TALKSASA] Invalid phone number: {phone}")
        return {"success": False, "error": f"Invalid phone: {phone}. Use format: 2547xxxxxxxx"}

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    payload = {
        "recipient": recipient,
        "message": message[:460],
        "sender_id": sender_id,
    }

    logger.info(f"[TALKSASA] Dispatching SMS to {recipient} via {sender_id}")

    try:
        r = requests.post(url, json=payload, headers=headers, timeout=12)
        if r.status_code in (200, 201):
            try:
                data = r.json()
                sms_id = data.get("id") or data.get("message_id")
                status = data.get("status", "").lower()
                if status in ("success", "sent", "queued", ""):
                    logger.info(f"[TALKSASA] [OK] SMS sent to {recipient} (ID: {sms_id})")
                    return {"success": True, "message": "SMS sent", "id": sms_id}
                else:
                    err = data.get("message") or data.get("error") or str(data)
                    logger.warning(f"[TALKSASA] Provider notice: {err}")
                    return {"success": False, "error": err}
            except Exception:
                return {"success": True, "message": "SMS sent"}
        else:
            err_text = r.text[:300]
            logger.error(f"[TALKSASA] Provider HTTP {r.status_code}: {err_text}")
            return {"success": False, "error": f"HTTP {r.status_code}: {err_text}"}
    except Exception as e:
        logger.error(f"[TALKSASA] Network error: {e}")
        return {"success": False, "error": str(e)}


def send_caregiver_sms_alert(phone: str, patient_name: str, dose_name: str, urgency: str = "Missed Dose") -> Dict[str, Any]:
    """Helper to dispatch formatted dose alerts directly to Caregivers via TalkSasa."""
    sms_text = (
        f"[Smart Med Alert - {urgency}]\n"
        f"Patient {patient_name} has an unacknowledged medication reminder for: {dose_name}.\n"
        f"Please check in with the patient or review the Caregiver Dashboard."
    )
    return send_sms_sync(phone, sms_text)


def send_emergency_sms_alert(phone: str, patient_name: str, symptoms: str) -> Dict[str, Any]:
    """Helper to dispatch high-priority emergency notifications to Caregivers and Clinicians via TalkSasa."""
    sms_text = (
        f"[EMERGENCY TRIAGE ALERT]\n"
        f"Patient {patient_name} reported severe symptoms:\n\"{symptoms[:180]}\"\n"
        f"Emergency hospital locations have been surfaced. Urgent attention is recommended."
    )
    return send_sms_sync(phone, sms_text)

