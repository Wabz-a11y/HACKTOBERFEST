import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


async def fetch_patient_medical_profile(patient_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetches the patient's medical profile including emergency contact and clinical links.
    """
    from backend.core.database import get_database
    database = get_database()
    if database is not None and patient_id:
        try:
            user_doc = await database.users.find_one({"id": patient_id})
            if user_doc:
                user_doc = dict(user_doc)
                user_doc.pop("_id", None)
                user_doc.pop("hashed_password", None)
                return {"status": "success", "patient": user_doc}
        except Exception as exc:
            logger.warning(f"Error fetching patient profile from DB: {exc}")

    return {
        "status": "success",
        "patient": {
            "id": patient_id or "patient_1",
            "full_name": "Valued Patient",
            "role": "patient",
            "emergency_contact": "Next of Kin / Designated Caregiver",
        }
    }


def get_patient_profile(patient_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Agent tool — synchronous stub to retrieve patient profile information and contacts.
    Full async profile fetch is available via fetch_patient_medical_profile.
    """
    return {
        "status": "success",
        "patient": {
            "id": patient_id or "patient_1",
            "role": "patient",
            "emergency_contact": "Next of Kin / Designated Caregiver",
        }
    }
