import asyncio
import logging
from datetime import datetime
from backend.services.notification import notification_manager
from backend.services.sms import send_caregiver_sms_alert
from backend.routers.reminders import _MEM_REMINDERS, ReminderStatus
from backend.core.config import settings

logger = logging.getLogger(__name__)

_scheduler_task: asyncio.Task = None
_running: bool = False


async def check_pending_reminders():
    """
    Periodic check verifying elapsed reminders and broadcasting WebSocket alerts.
    If TalkSasa API key and caregiver phone are configured, dispatches SMS escalation.
    """
    now = datetime.utcnow()
    for rem in _MEM_REMINDERS:
        if rem.get("status") == ReminderStatus.PENDING.value:
            scheduled = rem.get("scheduled_time")
            if not scheduled:
                continue
            diff_seconds = (now - scheduled).total_seconds()
            
            # Reminder due window (within 5 minutes of scheduled time)
            if 0 < diff_seconds <= 300 and not rem.get("notified"):
                rem["notified"] = True
                logger.info(f"Triggering scheduled alert for medication {rem.get('medication_name')}")
                await notification_manager.send_personal_message(
                    {
                        "type": "MEDICATION_REMINDER",
                        "reminder_id": rem.get("id"),
                        "medication": rem.get("medication_name"),
                        "dosage": rem.get("dosage"),
                        "instructions": rem.get("instructions")
                    },
                    user_id=rem.get("patient_id")
                )

            # If overdue by more than 30 minutes, escalate to caregiver via SMS if configured
            if diff_seconds > 1800 and not rem.get("sms_escalated"):
                rem["sms_escalated"] = True
                target_phone = rem.get("caregiver_phone") or settings.SUPPORT_PHONE
                patient_name = rem.get("patient_name") or "Patient"

                if settings.TALKSASA_API_KEY and target_phone:
                    send_caregiver_sms_alert(
                        phone=target_phone,
                        patient_name=patient_name,
                        dose_name=f"{rem.get('medication_name')} ({rem.get('dosage')})",
                        urgency="Missed Dose Escalation"
                    )


async def _run_loop():
    global _running
    _running = True
    while _running:
        try:
            await check_pending_reminders()
        except Exception as exc:
            logger.warning(f"Error in reminder loop: {exc}")
        await asyncio.sleep(60)


def start_scheduler():
    global _scheduler_task
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            _scheduler_task = loop.create_task(_run_loop())
            logger.info("Native asyncio adherence reminder scheduler started.")
    except Exception as exc:
        logger.warning(f"Asyncio scheduler could not attach task: {exc}")


def stop_scheduler():
    global _running, _scheduler_task
    _running = False
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
        logger.info("Native asyncio adherence reminder scheduler stopped.")
