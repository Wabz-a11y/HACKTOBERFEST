from datetime import datetime
from typing import Dict, Any, Optional


def write_summary(patient_id: str, adherence_rate: float, recent_symptoms: str, clinical_notes: str) -> Dict[str, Any]:
    """
    Compiles an AI longitudinal adherence summary and clinical triage note for the attending doctor.
    """
    summary = {
        "patient_id": patient_id,
        "date_generated": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "adherence_rate": f"{adherence_rate:.1f}%",
        "adherence_status": "High" if adherence_rate >= 80 else ("Moderate" if adherence_rate >= 60 else "Critical Non-Adherence"),
        "reported_symptoms": recent_symptoms or "None reported in the past 7 days",
        "clinical_assessment": clinical_notes,
        "recommendation": "Review dosage titration" if adherence_rate < 60 else "Continue current therapy regimen"
    }
    return {
        "status": "success",
        "summary": summary
    }

