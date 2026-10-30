import asyncio
import logging
from datetime import datetime
from backend.services.notification import notification_manager
from backend.routers.reminders import _MEM_REMINDERS, ReminderStatus

logger = logging.getLogger(__name__)

_scheduler_task: asyncio.Task = None
_running: bool = False


async def check_pending_reminders():
    """
    Periodic check verifying elapsed reminders and broadcasting notifications.
    """
    now = datetime.utcnow()
    for rem in _MEM_REMINDERS:
        if rem["status"] == ReminderStatus.PENDING.value:
            scheduled = rem["scheduled_time"]
            if (now - scheduled).total_seconds() > 0:
                logger.info(f"Triggering scheduled alert for medication {rem['medication_name']}")
                await notification_manager.send_personal_message(
                    {
                        "type": "MEDICATION_REMINDER",
                        "reminder_id": rem["id"],
                        "medication": rem["medication_name"],
                        "dosage": rem["dosage"],
                        "instructions": rem.get("instructions")
                    },
                    user_id=rem["patient_id"]
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
