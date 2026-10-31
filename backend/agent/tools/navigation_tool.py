import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

ROUTE_MAPPINGS = {
    "doses": {"target": "/doses", "page_name": "Dose Schedule"},
    "dose": {"target": "/doses", "page_name": "Dose Schedule"},
    "schedule": {"target": "/doses", "page_name": "Dose Schedule"},
    "dose_schedule": {"target": "/doses", "page_name": "Dose Schedule"},
    "dose schedule": {"target": "/doses", "page_name": "Dose Schedule"},
    "doses schedule": {"target": "/doses", "page_name": "Dose Schedule"},
    "timetable": {"target": "/doses", "page_name": "Dose Schedule"},
    "today's doses": {"target": "/doses", "page_name": "Dose Schedule"},

    "prescriptions": {"target": "/prescriptions", "page_name": "Prescriptions & Reminders"},
    "prescription": {"target": "/prescriptions", "page_name": "Prescriptions & Reminders"},
    "medications": {"target": "/prescriptions", "page_name": "Prescriptions & Reminders"},
    "meds": {"target": "/prescriptions", "page_name": "Prescriptions & Reminders"},
    "reminders": {"target": "/prescriptions", "page_name": "Prescriptions & Reminders"},

    "alerts": {"target": "/alerts", "page_name": "Clinical Alerts"},
    "alert": {"target": "/alerts", "page_name": "Clinical Alerts"},
    "notifications": {"target": "/alerts", "page_name": "Clinical Alerts"},

    "profile": {"target": "/profile", "page_name": "Patient Profile"},
    "my profile": {"target": "/profile", "page_name": "Patient Profile"},
    "settings": {"target": "/profile", "page_name": "Patient Profile"},

    "dashboard": {"target": "/", "page_name": "Dashboard Overview"},
    "home": {"target": "/", "page_name": "Dashboard Overview"},
    "overview": {"target": "/", "page_name": "Dashboard Overview"},
}


def navigate_to_page(page: str, reason: Optional[str] = None) -> Dict[str, Any]:
    """
    Agent tool to navigate the user interface to a target application page.
    Valid destination pages:
      - 'dose_schedule' or 'doses': Opens the full medication dose schedule and timetable.
      - 'prescriptions': Opens active prescriptions and medication intake manager.
      - 'alerts': Opens clinical alerts and triage history.
      - 'profile': Opens patient medical profile and emergency contacts.
      - 'dashboard': Returns to the primary overview dashboard.
    """
    key = (page or "").strip().lower()
    mapping = ROUTE_MAPPINGS.get(key)

    if not mapping:
        # Fallback substring matching
        for k, route_data in ROUTE_MAPPINGS.items():
            if k in key:
                mapping = route_data
                break

    if not mapping:
        # Default to dose schedule if dose is mentioned, else dashboard
        if "dose" in key or "schedule" in key:
            mapping = ROUTE_MAPPINGS["dose_schedule"]
        else:
            mapping = ROUTE_MAPPINGS["dashboard"]

    action_payload = {
        "action": "navigate",
        "target": mapping["target"],
        "page_name": mapping["page_name"],
        "reason": reason or f"Navigating to {mapping['page_name']} as requested."
    }

    logger.info(f"[NAVIGATE TOOL] Target={action_payload['target']} | Page={action_payload['page_name']}")
    return action_payload
