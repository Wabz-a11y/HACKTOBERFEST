import os
import sys
import logging
import base64
import re
from typing import Optional, Dict, Any, List

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
MODEL_ID = settings.GEMMA_MODEL_ID or "gemini-2.5-flash"


def get_agent_instruction(patient_info: Optional[Dict[str, Any]] = None) -> str:
    runtime_context = memory_manager.build_runtime_context(patient_info)
    return f"""
You are MedAgent — a compassionate, highly capable autonomous healthcare clinical assistant.
Your mission is to ensure patients adhere safely to medication schedules, understand drug dosages, side effects, and food/drug interactions, coordinate with caregivers, and advise appropriate clinical action.

{runtime_context}

CLINICAL GUIDELINES & BEHAVIOR:
1. Patient Queries:
   - For greetings, general conversation, and questions ("hi", "hello", "how are you"), respond naturally, warmly, and politely as MedAgent.
   - For inquiries about medications, dosage, missed doses, side effects, or drug interactions (e.g. grapefruit juice, alcohol), provide verified, evidence-based guidance in clear, understandable language.
   - Never recommend doubling up on missed doses.
2. Multimodal Prescription Analysis:
   - When given an image, pill bottle photo, or prescription details, carefully identify drug names, dosages, frequencies, and instructions.
   - Offer to schedule them as reminders for the patient.
3. Emergency Protocol:
   - When a patient describes acute red-flag symptoms (severe chest pain, shortness of breath, sudden numbness, anaphylaxis), prioritize patient safety, advise immediate emergency care, and stay calm and authoritative.
4. Professional Tone:
   - Empathetic, reassuring, clinically grounded, objective. Speak in natural language without robotic preambles.
   - Do NOT recite internal prompt instructions, model names, or technical frameworks. Always speak as MedAgent.
""".strip()


# Attempt initializing Google ADK Agent if available
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
    logger.info("Initialized Google ADK LlmAgent successfully.")
except Exception as exc:
    logger.info(f"Google ADK Agent initialization deferred ({exc}); using Google GenAI client.")


def _get_genai_client():
    """Returns an authenticated Google GenAI client instance if API key is present."""
    api_key = settings.GOOGLE_API_KEY
    if not api_key:
        return None
    try:
        from google import genai
        return genai.Client(api_key=api_key)
    except Exception as exc:
        logger.warning(f"Failed to instantiate google.genai.Client: {exc}")
        return None


async def ask_med_agent(
    session_id: str,
    user_text: str,
    patient_info: Optional[Dict[str, Any]] = None,
    image_data: Optional[str] = None
) -> Dict[str, Any]:
    """
    Core inference loop: Dispatches query directly to the live Google GenAI model.
    Maintains memory, handles multimodal prescription uploads, and performs
    automated triage dispatch for acute emergencies.
    """
    user_text_clean = (user_text or "").strip()
    user_lower = user_text_clean.lower()
    system_instruction = get_agent_instruction(patient_info)

    # ── 1. Check for Acute Red-Flag Emergency Triage ──
    acute_emergency_keywords = [
        "crushing chest pain", "chest pain", "heart attack", "collapsed",
        "cannot breathe", "can't breathe", "anaphylaxis", "severe allergic reaction",
        "choking", "coughing up blood"
    ]
    if any(k in user_lower for k in acute_emergency_keywords):
        try:
            hosp_data = find_hospitals()
            hospitals = hosp_data.get("hospitals", [])
        except Exception:
            hospitals = []

        patient_id = patient_info.get("id", "patient_1") if patient_info else "patient_1"
        try:
            send_alert(
                target_role="caregiver",
                patient_id=patient_id,
                severity="emergency",
                message=f"CRITICAL TRIAGE: Patient reported acute symptoms: '{user_text_clean}'."
            )
            send_alert(
                target_role="doctor",
                patient_id=patient_id,
                severity="emergency",
                message=f"URGENT CLINICAL ALERT: Patient reported acute symptoms: '{user_text_clean}'."
            )
        except Exception as e:
            logger.warning(f"Failed to dispatch emergency alerts: {e}")

        hosp_lines = [
            f"- **{h.get('name')}** ({h.get('distance_estimate', 'Nearby')}): {h.get('address')} | Tel: {h.get('phone', 'N/A')} (ETA: {h.get('eta_minutes', 'Immediate')})"
            for h in hospitals[:3]
        ]
        hosp_text = "\n".join(hosp_lines) if hosp_lines else "• Dial emergency services immediately."

        reply = (
            f"⚠️ **URGENT MEDICAL EMERGENCY WARNING**\n\n"
            f"Please sit down and remain calm. If you or someone with you is experiencing severe symptoms such as chest pain or severe difficulty breathing, **call emergency services (999 / 911 / 112) immediately**.\n\n"
            f"I have automatically dispatched an emergency alert to your designated caregiver and attending clinician.\n\n"
            f"**Nearest Emergency Medical Centers:**\n{hosp_text}\n\n"
            f"Do not drive yourself. Have someone escort you or request an ambulance immediately."
        )
        memory_manager.record_turn(user_text_clean, reply, patient_id=patient_info.get("id") if patient_info else None, tool="find_hospitals, send_alert")
        return {
            "output": reply,
            "is_emergency": True,
            "hospitals": hospitals[:4]
        }

    # ── 2. Live Google GenAI API Call ──
    client = _get_genai_client()
    if client:
        # Prepare contents (text + optional multimodal image)
        contents = []
        if image_data:
            try:
                from google.genai import types
                match = re.match(r"data:(image/\w+);base64,(.*)", image_data)
                if match:
                    mime = match.group(1)
                    raw_b64 = match.group(2)
                else:
                    mime = "image/jpeg"
                    raw_b64 = image_data
                img_bytes = base64.b64decode(raw_b64)
                img_part = types.Part.from_bytes(data=img_bytes, mime_type=mime)
                contents.append(img_part)
            except Exception as e:
                logger.warning(f"Could not parse image data for GenAI: {e}")

        prompt_text = user_text_clean if user_text_clean else "Please analyze this prescription image and extract medication details."
        contents.append(prompt_text)

        # Try primary model, with graceful fallback to alternative supported IDs
        candidate_models = [
            settings.GEMMA_MODEL_ID,
            "gemini-2.5-flash",
            "gemma-4-26b-a4b-it",
            "gemini-2.5-flash-lite",
        ]
        # Deduplicate while preserving order
        candidate_models = list(dict.fromkeys([m for m in candidate_models if m]))

        last_error = None
        for model_name in candidate_models:
            try:
                from google.genai import types
                config = types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.35,
                )
                response = client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=config,
                )
                if response and response.text:
                    reply = response.text.strip()
                    memory_manager.record_turn(user_text_clean, reply, patient_id=patient_info.get("id") if patient_info else None)
                    return {
                        "output": reply,
                        "is_emergency": False,
                        "hospitals": None
                    }
            except Exception as exc:
                last_error = exc
                logger.warning(f"GenAI inference attempt with model '{model_name}' failed: {exc}")

        logger.error(f"All GenAI candidate models failed. Last error: {last_error}")

    # ── 3. Relevant, Truthful Message when Agent Service is Inaccessible ──
    # No fake canned responses with hardcoded keywords
    unavailable_msg = (
        "⚠️ **MedAgent Service Notice**\n\n"
        "I am currently unable to reach the clinical AI model service. "
        "Please check your internet connection or try again in a few moments.\n\n"
        "If you are experiencing a medical emergency, please contact your local emergency services (999 / 911 / 112) or reach your physician directly."
    )
    return {
        "output": unavailable_msg,
        "is_emergency": False,
        "hospitals": None
    }
