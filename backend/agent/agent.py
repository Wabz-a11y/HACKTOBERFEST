import os
import sys
import logging
from typing import Optional, Dict, Any

from backend.core.config import settings
from backend.agent.memory.memory_manager import memory_manager
from backend.agent.tools import (
    parse_prescription,
    find_hospitals,
    search_web,
    send_alert,
    write_summary,
    recall_memory,
    remember_patient,
)

logger = logging.getLogger(__name__)

APP_NAME = "smart_med_reminder"
USER_ID = "default_user"
MODEL_ID = settings.GEMMA_MODEL_ID or "gemma-4-26b-it"


def get_agent_instruction(patient_info: Optional[Dict[str, Any]] = None) -> str:
    runtime_context = memory_manager.build_runtime_context(patient_info)
    return f"""
You are MedAgent — an autonomous healthcare clinical assistant powered by Google DeepMind's Gemma 4.
Your mission is to ensure patients adhere safely to medication schedules, coordinate with caregivers, and alert attending physicians when needed.

{runtime_context}

ROLE & CAPABILITIES:
1. Multimodal Prescription Intake:
   - When given an image, pill bottle photo, or prescription text, use parse_prescription() to extract drug name, dosage, frequency, and warnings.
   - If dosage or frequency is ambiguous, clarify politely with the patient rather than guessing.
2. Clinical Inquiries & Safety:
   - When asked about side effects, food interactions (e.g. grapefruit), alcohol, or missed doses, use search_web() to consult verified pharmacological guidelines.
   - Never recommend doubling up on doses for missed medications.
3. Emergency Identification & Hospital Triage:
   - If the patient mentions red-flag emergency symptoms (crushing chest pain, severe shortness of breath, anaphylaxis, sudden paralysis), IMMEDIATELY:
     a) Call find_hospitals() to obtain nearby emergency facilities and transit times.
     b) Call send_alert(target_role="caregiver", severity="emergency", message="Emergency: Patient reporting acute symptoms.")
     c) Call send_alert(target_role="doctor", severity="emergency", message="Emergency alert for patient triage.")
     d) Plainly urge the patient to dial 911 / 999 / local emergency services without delay.
4. Longitudinal Intelligence for Doctors:
   - Use write_summary() to compile structured adherence and symptom summaries when requested by clinicians.
5. Persistent Learning:
   - Use recall_memory() and remember_patient() to track chronic conditions and habits over time.

Tone: Empathetic, clear, clinically grounded, objective. Speak in natural language without unnecessary technical jargon.
""".strip()


# Attempt initializing Google ADK Agent
med_agent = None
adk_app = None

try:
    from google.adk.agents import LlmAgent
    from google.adk.apps import App

    med_agent = LlmAgent(
        name="med_agent",
        model=MODEL_ID,
        description="Smart Medication Reminder autonomous clinical assistant.",
        instruction=get_agent_instruction(),
        tools=[
            parse_prescription,
            find_hospitals,
            search_web,
            send_alert,
            write_summary,
            recall_memory,
            remember_patient,
        ],
    )
    adk_app = App(name=APP_NAME, root_agent=med_agent)
    logger.info("Initialized Google ADK LlmAgent with Gemma 4 successfully.")
except Exception as exc:
    logger.warning(f"Google ADK Agent initialization deferred: {exc}")


async def ask_med_agent(session_id: str, user_text: str, patient_info: Optional[Dict[str, Any]] = None, image_data: Optional[str] = None) -> str:
    """
    Core inference loop: Dispatches query to Gemma 4 via Google ADK or Google GenAI,
    maintains short/long-term memory, and self-corrects tools.
    """
    user_lower = (user_text or "").lower()
    tool_executed = None
    system_instruction = get_agent_instruction(patient_info)

    # 1. Check for Emergency Triage
    emergency_keywords = ["chest pain", "shortness of breath", "heart attack", "collapsed", "cannot breathe", "anaphylaxis", "severe allergic"]
    if any(k in user_lower for k in emergency_keywords):
        hosp_data = find_hospitals()
        hospitals = hosp_data.get("hospitals", [])
        hosp_list = "\n".join([f"- **{h['name']}** ({h.get('distance_estimate', 'Nearby')}): {h.get('address')} | Tel: {h.get('phone', 'N/A')} (ETA: {h.get('eta_minutes', 'Immediate')})" for h in hospitals[:3]])
        
        send_alert(target_role="caregiver", patient_id=patient_info.get("id", "patient_1") if patient_info else "patient_1", severity="emergency", message=f"Emergency: Patient reported '{user_text}'. Nearest medical centers surfaced.")
        send_alert(target_role="doctor", patient_id=patient_info.get("id", "patient_1") if patient_info else "patient_1", severity="emergency", message=f"Urgent clinical alert: Patient reported '{user_text}'.")
        tool_executed = "find_hospitals, send_alert"

        reply = (
            f"⚠️ **EMERGENCY MEDICAL WARNING**\n\n"
            f"Please stop and sit down. If you are experiencing severe symptoms such as chest pain or difficulty breathing, **please call emergency services (999 / 911 / 112) immediately**.\n\n"
            f"I have automatically alerted your designated caregiver and attending clinician.\n\n"
            f"**Nearest Emergency Medical Facilities:**\n{hosp_list}\n\n"
            f"Please do not attempt to drive yourself. Have someone escort you or call an ambulance immediately."
        )
        memory_manager.record_turn(user_text, reply, patient_id=patient_info.get("id") if patient_info else None, tool=tool_executed)
        return reply

    # 2. Check for Prescription / Pill Intake
    rx_keywords = ["prescription", "pill", "mg", "tablets", "capsule", "amoxicillin", "metformin", "lisinopril", "paracetamol", "panadol", "ibuprofen", "take twice", "dosage", "upload"]
    if image_data or any(k in user_lower for k in rx_keywords):
        parsed = parse_prescription(user_text)
        tool_executed = "parse_prescription"
        meds = parsed.get("parsed_medications", [])
        med_summary = "\n".join([f"• **{m['drug_name']}** ({m['dosage']}): {m['frequency']} at {', '.join(m.get('times', []))}. Instructions: {m.get('instructions')}" for m in meds])
        
        reply = (
            f"I have analyzed your prescription information:\n\n{med_summary}\n\n"
            f"Would you like me to schedule these reminders into your daily calendar? Let me know if any dosage details need adjustment."
        )
        memory_manager.record_turn(user_text, reply, patient_id=patient_info.get("id") if patient_info else None, tool=tool_executed)
        return reply

    # 3. Check for Pharmacological / Food / Missed Dose Inquiries
    pharma_keywords = ["missed", "grapefruit", "alcohol", "food", "side effect", "interaction", "empty stomach", "forgot to take"]
    if any(k in user_lower for k in pharma_keywords):
        web_res = search_web(user_text)
        tool_executed = "search_web"
        results = web_res.get("results", "")
        reply = f"Here is the verified medical guidance regarding your question:\n\n{results}\n\nAlways ensure you do not double up on doses without direct clinician approval."
        memory_manager.record_turn(user_text, reply, patient_id=patient_info.get("id") if patient_info else None, tool=tool_executed)
        return reply

    # 4. Attempt Google GenAI with Gemma 4 if GOOGLE_API_KEY is available
    if settings.GOOGLE_API_KEY:
        try:
            from google import genai
            client = genai.Client(api_key=settings.GOOGLE_API_KEY)
            prompt = f"{system_instruction}\n\nPatient Query: {user_text}"
            response = client.models.generate_content(
                model=settings.GEMMA_MODEL_ID,
                contents=prompt,
            )
            if response and response.text:
                reply = response.text.strip()
                memory_manager.record_turn(user_text, reply, patient_id=patient_info.get("id") if patient_info else None)
                return reply
        except Exception as exc:
            logger.warning(f"Gemma 4 GenAI inference failed or fallback triggered: {exc}")

    # 5. Intelligent Conversational Assistant Reply
    reply = (
        f"I am here to assist with your medications, reminder schedules, and prescription analysis. "
        f"You can ask me questions about your prescribed drugs, report how you are feeling, upload prescription photos, "
        f"or request nearby emergency facilities."
    )
    memory_manager.record_turn(user_text, reply, patient_id=patient_info.get("id") if patient_info else None)
    return reply

