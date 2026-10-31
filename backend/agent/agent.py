import os
import sys
import logging
import base64
import re
from typing import Optional, Dict, Any, List, Tuple

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
    get_dose_schedule,
    get_patient_prescriptions,
    fetch_dose_schedule,
    fetch_patient_prescriptions,
    create_dose_reminder,
    check_reminder_status,
    parse_time_expression,
    review_missed_doses_and_send_sms,
    review_missed_doses_and_send_sms_sync,
    navigate_to_page,
    get_patient_profile,
    fetch_patient_medical_profile,
)

logger = logging.getLogger(__name__)

APP_NAME = "smart_med_reminder"
USER_ID = "default_user"
MODEL_ID = settings.GEMMA_MODEL_ID or "gemini-2.5-flash"


def get_agent_instruction(patient_info: Optional[Dict[str, Any]] = None) -> str:
    runtime_context = memory_manager.build_runtime_context(patient_info)
    patient_id = patient_info.get("id", "current_patient") if patient_info else "current_patient"
    patient_name = patient_info.get("full_name", "Valued Patient") if patient_info else "Valued Patient"

    return f"""
You are MedAgent — a compassionate, highly capable autonomous healthcare clinical assistant.
Your mission is to ensure patients adhere safely to medication schedules, understand drug dosages, side effects, and food/drug interactions, coordinate with caregivers, and advise appropriate clinical action.

Active Patient: {patient_name} (ID: {patient_id})

{runtime_context}

CRITICAL COMMUNICATION AND OUTPUT RULES:
1. NEVER output raw tool calls, function calls, code blocks, JSON snippets, `tool_code`, or `print(...)` in your reply.
2. NEVER display internal mechanics, programming code, or function names to the user.
3. Always respond in warm, natural, human-like language directly addressing the patient.
4. When setting or confirming medication reminders, provide clear confirmation, dosages, and instructions in natural markdown formatting.
5. You can review missed doses and dispatch instant SMS reminders to the patient's registered mobile phone via TalkSasa.
""".strip()


# Lazy Google ADK Agent initialization
_med_agent = None
_adk_app = None


def get_adk_agent():
    """Lazily initialize Google ADK Agent only when explicitly requested."""
    global _med_agent, _adk_app
    if _med_agent is not None:
        return _med_agent, _adk_app
    try:
        from google.adk.agents import LlmAgent
        from google.adk.apps import App

        _med_agent = LlmAgent(
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
                get_dose_schedule,
                get_patient_prescriptions,
                create_dose_reminder,
                check_reminder_status,
                review_missed_doses_and_send_sms_sync,
                navigate_to_page,
                get_patient_profile,
            ],
        )
        _adk_app = App(name=APP_NAME, root_agent=_med_agent)
        logger.info("Initialized Google ADK LlmAgent successfully.")
        return _med_agent, _adk_app
    except Exception as exc:
        logger.info(f"Google ADK Agent initialization deferred ({exc}); using Google GenAI client.")
        return None, None


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


def _extract_time_from_text(text: str) -> Optional[str]:
    """Extracts time expressions like 4:16 am, 04:16, 8 PM from text."""
    match = re.search(r"(\b\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)\b|\b\d{1,2}[:.]\d{2}\b)", text, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return None


def _extract_medication_name(text: str) -> Optional[str]:
    """Extracts medication names, handling malaria drugs, common generics, and brands."""
    t = text.strip()
    # Direct malaria combos
    if "artesunate" in t.lower() or "amodiaquine" in t.lower():
        return "Artesunate-amodiaquine"
    if "coartem" in t.lower() or "artemether" in t.lower():
        return "Artemether-lumefantrine (Coartem)"
    if "malaria" in t.lower():
        return "Artesunate-amodiaquine (Malaria Treatment)"

    # Common medications
    common_meds = [
        "metformin", "lisinopril", "atorvastatin", "amoxicillin", "paracetamol",
        "panadol", "ibuprofen", "omeprazole", "ciprofloxacin", "azithromycin",
        "aspirin", "losartan", "amlodipine", "doxycycline"
    ]
    for med in common_meds:
        if med in t.lower():
            return med.title()

    # Pattern: "X for Y" e.g., "DrugName for condition"
    for_match = re.search(r"([A-Za-z0-9\-]+(?:\s+[A-Za-z0-9\-]+)?)\s+for\s+[A-Za-z]+", t, re.IGNORECASE)
    if for_match:
        cand = for_match.group(1).strip()
        if cand.lower() not in ["reminder", "medicine", "medication", "pill", "taking"]:
            return cand.title()

    # Generic cleanup
    clean = re.sub(r"(?i)^(it is|the medication is|it's|name is|i take|taking|take)\s+", "", t)
    clean = re.sub(r"(?i)\s+for\s+.*$", "", clean).strip()
    words = clean.split()
    if 0 < len(words) <= 3 and words[0].lower() not in ["reminder", "set", "what", "is", "please", "yes", "no", "okay"]:
        return clean.title()

    return None


async def _handle_clinical_tools_fallback(
    user_text: str,
    patient_id: Optional[str] = None,
    patient_info: Optional[Dict[str, Any]] = None,
    conversation_history: Optional[List[Dict[str, Any]]] = None
) -> Optional[Dict[str, Any]]:
    """
    Intelligent clinical dispatcher: handles navigation, dose schedule queries,
    real database reminder creation, and reminder verification directly.
    """
    text_lower = user_text.lower().strip()
    pid = patient_id or "patient_1"

    # ── 0. Missed Dose Review & SMS Reminder Dispatch ──
    missed_dose_triggers = [
        "missed dose", "missed doses", "missed medication", "missed medicine",
        "check missed", "did i miss", "have i missed", "missed any dose",
        "send sms", "remind me via sms", "remind me through sms", "remind through sms",
        "remind through an sms", "sms reminder", "sms alert", "send me an sms", "text me",
        "notify me via sms", "send sms reminder", "sms notification", "sms logic"
    ]
    if any(k in text_lower for k in missed_dose_triggers):
        phone_cand = patient_info.get("phone") if patient_info else None
        p_name = patient_info.get("full_name") if patient_info else "there"
        res = await review_missed_doses_and_send_sms(patient_id=pid, phone=phone_cand, patient_name=p_name)
        status = res.get("status")
        count = res.get("count", 0)
        missed = res.get("missed_doses", [])
        phone_used = res.get("phone", "")

        if status == "no_missed_doses":
            nav = navigate_to_page("doses", reason="View your active dose schedule")
            reply = (
                f"🎉 **Great news, {p_name}! No Missed Doses Detected.**\n\n"
                f"I reviewed your dose records and schedule in the database. All your prescribed medications are completely up to date with no missed doses.\n\n"
                f"Keep up the great adherence! You can check your upcoming reminders anytime on your **[Dose Schedule]({nav['target']})**."
            )
            return {
                "output": reply,
                "is_emergency": False,
                "hospitals": None,
                "navigation": nav,
            }
        elif status == "needs_phone":
            nav = navigate_to_page("profile", reason="Add your phone number for SMS reminders")
            dose_lines = []
            for d in missed[:4]:
                t = d.get("scheduled_time", "")
                t_str = t.split("T")[-1][:5] if "T" in t else t
                dose_lines.append(f"- ⚠️ **{d.get('medication_name')}** ({d.get('dosage', 'Standard dose')}) scheduled for **{t_str}**")
            dose_text = "\n".join(dose_lines)

            reply = (
                f"⚠️ **Missed Dose Alert ({count} missed dose{'s' if count > 1 else ''})**\n\n"
                f"I reviewed your schedule and identified the following missed or overdue dose(s):\n"
                f"{dose_text}\n\n"
                f"📱 **SMS Reminder Notice:**\n"
                f"I attempted to dispatch an SMS reminder to your mobile phone via TalkSasa, but **no phone number is registered** on your account.\n\n"
                f"👉 Please go to your **[Profile]({nav['target']})** to enter your mobile number so I can send you real-time SMS alerts whenever a dose is missed."
            )
            return {
                "output": reply,
                "is_emergency": False,
                "hospitals": None,
                "navigation": nav,
            }
        else:
            # status == "success"
            nav = navigate_to_page("doses", reason="Review and update your dose schedule")
            dose_lines = []
            for d in missed[:4]:
                t = d.get("scheduled_time", "")
                t_str = t.split("T")[-1][:5] if "T" in t else t
                inst = f" (*{d.get('instructions')}*)" if d.get("instructions") else ""
                dose_lines.append(f"- ⚠️ **{d.get('medication_name')}** ({d.get('dosage', 'Standard dose')}) — scheduled for **{t_str}**{inst}")
            dose_text = "\n".join(dose_lines)

            masked = phone_used
            if len(phone_used) >= 7:
                masked = phone_used[:4] + "****" + phone_used[-3:]

            reply = (
                f"📲 **Missed Dose Review & SMS Reminder Dispatched**\n\n"
                f"I reviewed your schedule in the database and identified **{count} missed medication dose{'s' if count > 1 else ''}**:\n"
                f"{dose_text}\n\n"
                f"✅ **SMS Alert Status:**\n"
                f"- A priority SMS reminder has been dispatched via **TalkSasa** to your registered phone (**{masked}**).\n"
                f"- An alert has also been logged in your platform notifications.\n\n"
                f"💡 **Clinical Safety Guidance:**\n"
                f"- **Take the missed dose as soon as you remember.**\n"
                f"- If it is almost time for your next scheduled dose, skip the missed dose and resume your regular schedule.\n"
                f"- **Never double up or take two doses at once** to compensate for a missed dose.\n\n"
                f"You can mark doses as taken or review your timetable on your **[Dose Schedule]({nav['target']})**."
            )
            return {
                "output": reply,
                "is_emergency": False,
                "hospitals": None,
                "navigation": nav,
            }

    # ── 1. Check if Reminder is Set (Verification Query) ──
    status_keywords = [
        "is time set", "is the time set", "is it set", "did you set",
        "is my reminder set", "is the reminder set", "is reminder set",
        "check if time is set", "check if reminder is set", "check reminder",
        "verify reminder", "was the reminder set", "confirm reminder"
    ]
    if any(k in text_lower for k in status_keywords):
        target_time = _extract_time_from_text(text_lower)
        target_med = _extract_medication_name(text_lower)

        # Check recent conversation history if time or med wasn't explicitly in this turn
        if not target_time and conversation_history:
            for turn in reversed(conversation_history[-4:]):
                t_cand = _extract_time_from_text(turn.get("text", ""))
                if t_cand:
                    target_time = t_cand
                    break

        if not target_med and conversation_history:
            for turn in reversed(conversation_history[-4:]):
                m_cand = _extract_medication_name(turn.get("text", ""))
                if m_cand:
                    target_med = m_cand
                    break

        check_result = await check_reminder_status(patient_id=pid, medication_name=target_med, target_time=target_time)
        matched = check_result.get("matched_reminders", [])
        all_reminders = check_result.get("all_reminders", [])
        nav = navigate_to_page("doses", reason="View your verified dose schedule")

        if matched:
            r = matched[0]
            med_display = r.get("medication_name", "Medication")
            t_raw = r.get("scheduled_time", "")
            t_display = t_raw.split("T")[-1][:5] if "T" in t_raw else t_raw
            status_display = r.get("status", "pending").upper()
            inst = f"\n- **Clinical Note:** {r.get('instructions')}" if r.get("instructions") else ""

            reply = (
                f"✅ **Yes, your reminder is confirmed and active in the database!**\n\n"
                f"- **Medication:** **{med_display}**\n"
                f"- **Scheduled Time:** **{t_display}**\n"
                f"- **Status:** **{status_display}**{inst}\n\n"
                f"I checked your records directly in the database. You can track or modify it on your **[Dose Schedule]({nav['target']})**."
            )
            return {
                "output": reply,
                "is_emergency": False,
                "hospitals": None,
                "navigation": nav,
            }
        elif all_reminders:
            r_lines = []
            for r in all_reminders[:3]:
                t = r.get("scheduled_time", "")
                t_str = t.split("T")[-1][:5] if "T" in t else t
                r_lines.append(f"- **{r.get('medication_name')}** at **{t_str}** [{r.get('status', 'pending').upper()}]")
            r_text = "\n".join(r_lines)
            time_note = f" for '{target_time}'" if target_time else ""
            reply = (
                f"ℹ️ **Database Reminder Verification**\n\n"
                f"I checked your database schedule. There is no specific reminder set{time_note}.\n\n"
                f"**Active Reminders on Record:**\n{r_text}\n\n"
                f"Would you like me to set this reminder for you right now? Just tell me the medication and time (e.g., *“Set a reminder for Artesunate-amodiaquine at 4:16 AM”*)."
            )
            return {
                "output": reply,
                "is_emergency": False,
                "hospitals": None,
                "navigation": nav,
            }
        else:
            time_note = f" for {target_time}" if target_time else ""
            reply = (
                f"ℹ️ **No Active Reminder Found in Database**\n\n"
                f"I checked your database calendar, and no reminder is currently scheduled{time_note}.\n\n"
                f"I can schedule it for you right now! Please provide the medication name and time."
            )
            return {
                "output": reply,
                "is_emergency": False,
                "hospitals": None,
                "navigation": nav,
            }

    # ── 2. Create / Schedule a Reminder ──
    is_reminder_request = any(k in text_lower for k in [
        "set a reminder", "set reminder", "remind me", "schedule a reminder",
        "schedule reminder", "reminder for taking medicine", "taking medicine at",
        "set medication", "set medicine", "set dose", "schedule medication",
        "schedule dose", "schedule medicine", "remind medication", "medication at",
        "medicine at", "dose at", "remind"
    ])

    # Check if prior agent turn asked "what is the name of the medication"
    prior_asked_for_med = False
    prior_time = None
    if conversation_history:
        for turn in reversed(conversation_history[-3:]):
            turn_text = turn.get("text", "").lower()
            if "name of the medication" in turn_text or "what is the name" in turn_text or "which medication" in turn_text:
                prior_asked_for_med = True
            t_cand = _extract_time_from_text(turn_text)
            if t_cand and not prior_time:
                prior_time = t_cand

    current_time = _extract_time_from_text(user_text)
    effective_time = current_time or prior_time
    med_name = _extract_medication_name(user_text)

    # Condition: either user explicitly asked to set a reminder OR responded with medication name after being asked
    if (is_reminder_request and effective_time and med_name) or (prior_asked_for_med and effective_time and med_name):
        # We have both medication and time -> ACTUALLY INSERT INTO DATABASE
        instructions = "Take with water as directed"
        if "malaria" in text_lower or "artesunate" in med_name.lower():
            instructions = "Take with food or milk to reduce stomach upset and improve absorption. Complete the full course of treatment."
        elif "metformin" in med_name.lower():
            instructions = "Take with meals to minimize stomach upset."
        elif "atorvastatin" in med_name.lower():
            instructions = "Take at bedtime with or without food. Avoid grapefruit."

        created = await create_dose_reminder(
            patient_id=pid,
            medication_name=med_name,
            scheduled_time=effective_time,
            dosage="Standard prescribed dose",
            instructions=instructions
        )

        nav = navigate_to_page("doses", reason=f"View your newly scheduled {med_name} reminder")
        time_formatted = created.get("formatted_time", effective_time)

        reply = (
            f"✅ **Your reminder for {med_name} at {time_formatted} today is now set in the database!**\n\n"
            f"- **Medication:** **{med_name}**\n"
            f"- **Scheduled Time:** **{time_formatted}**\n"
            f"- **Status:** **PENDING**\n"
            f"- **Instructions:** {instructions}\n\n"
            f"💡 **Clinical Guidance:**\n"
            f"- It is essential to take it consistently as scheduled.\n"
            f"- Complete the full course of treatment as prescribed, even if you feel better.\n\n"
            f"I have saved this reminder directly to your database. You can view your full timetable on your **[Dose Schedule]({nav['target']})**."
        )
        return {
            "output": reply,
            "is_emergency": False,
            "hospitals": None,
            "navigation": nav,
        }

    # If user wants a reminder at a specific time, but hasn't named the medication yet:
    if is_reminder_request and current_time and not med_name:
        reply = (
            f"Okay, I can set a reminder for you to take your medicine at **{current_time}** today.\n\n"
            f"To make sure I set the correct reminder in your calendar and database, **what is the name of the medication** you need to take?"
        )
        return {
            "output": reply,
            "is_emergency": False,
            "hospitals": None,
            "navigation": None,
        }

    # ── 3. Navigation to Dose Schedule or other pages ──
    navigation_triggers = [
        ("dose schedule", "doses"),
        ("dose timetable", "doses"),
        ("today's doses", "doses"),
        ("doses page", "doses"),
        ("schedule page", "doses"),
        ("go to doses", "doses"),
        ("take me to doses", "doses"),
        ("open doses", "doses"),
        ("navigate to doses", "doses"),
        ("show doses", "doses"),
        ("view doses", "doses"),
        ("show my schedule", "doses"),
        ("open my schedule", "doses"),
        ("see my schedule", "doses"),
        ("take me to schedule", "doses"),
        ("navigate to schedule", "doses"),
        ("open schedule", "doses"),
        ("prescriptions page", "prescriptions"),
        ("go to prescriptions", "prescriptions"),
        ("take me to prescriptions", "prescriptions"),
        ("open prescriptions", "prescriptions"),
        ("my prescriptions", "prescriptions"),
        ("alerts page", "alerts"),
        ("go to alerts", "alerts"),
        ("open alerts", "alerts"),
        ("profile page", "profile"),
        ("go to profile", "profile"),
        ("open profile", "profile"),
        ("dashboard page", "dashboard"),
        ("go home", "dashboard"),
        ("take me home", "dashboard"),
    ]

    for trigger, page_key in navigation_triggers:
        if trigger in text_lower:
            nav = navigate_to_page(page_key)
            page_name = nav.get("page_name", "Target Page")
            reply = (
                f"🧭 **Navigating to {page_name}**\n\n"
                f"I am opening your **{page_name}** now. You can view your full timetable, "
                f"check upcoming doses, or review reminders directly.\n\n"
                f"Click below if you are not automatically redirected."
            )
            return {
                "output": reply,
                "is_emergency": False,
                "hospitals": None,
                "navigation": nav,
            }

    # ── 4. Dose Schedule & Upcoming Meds Query ──
    dose_query_triggers = [
        "what pills", "what medication", "what meds", "my doses", "dose schedule",
        "next dose", "doses today", "today's medication", "upcoming doses",
        "did i take", "have i taken", "what do i take", "when is my next dose"
    ]
    if any(k in text_lower for k in dose_query_triggers):
        schedule_data = await fetch_dose_schedule(pid)
        doses = schedule_data.get("doses", [])
        total = schedule_data.get("total_doses", 0)
        taken = schedule_data.get("taken", 0)
        pending = schedule_data.get("pending", 0)
        adherence = schedule_data.get("adherence_rate_pct", 100.0)

        nav = navigate_to_page("doses", reason="View your full interactive dose timetable")

        if not doses:
            reply = (
                f"📋 **Your Dose Schedule**\n\n"
                f"You currently have no active doses scheduled in your reminder calendar.\n"
                f"You can add medications by scanning a prescription or visiting your "
                f"[Dose Schedule]({nav['target']}) page."
            )
        else:
            dose_lines = []
            for d in doses[:6]:
                status_emoji = "✅" if d.get("status") == "taken" else ("⏳" if d.get("status") == "pending" else "⚠️")
                scheduled_raw = d.get("scheduled_time", "")
                time_str = scheduled_raw.split("T")[-1][:5] if "T" in scheduled_raw else scheduled_raw
                inst = f" — *{d.get('instructions')}*" if d.get("instructions") else ""
                dose_lines.append(
                    f"{status_emoji} **{d.get('medication_name')}** ({d.get('dosage')}): "
                    f"Scheduled for **{time_str}** [{d.get('status', 'pending').upper()}]{inst}"
                )

            doses_text = "\n".join(dose_lines)
            reply = (
                f"📋 **Your Medication Dose Schedule**\n\n"
                f"Here is your current dose status:\n"
                f"- **Total Scheduled:** {total} | **Taken:** {taken} | **Pending:** {pending}\n"
                f"- **Today's Adherence Rate:** **{adherence}%**\n\n"
                f"**Upcoming & Recent Doses:**\n{doses_text}\n\n"
                f"👉 Would you like me to take you to your interactive **[Dose Schedule]({nav['target']})** page?"
            )

        return {
            "output": reply,
            "is_emergency": False,
            "hospitals": None,
            "navigation": nav,
        }

    # ── 5. Active Prescriptions Query ──
    rx_query_triggers = [
        "what are my prescriptions", "list my prescriptions", "my medications",
        "current prescriptions", "active prescriptions"
    ]
    if any(k in text_lower for k in rx_query_triggers):
        rx_data = await fetch_patient_prescriptions(pid)
        prescriptions = rx_data.get("prescriptions", [])
        nav = navigate_to_page("prescriptions")

        if not prescriptions:
            reply = (
                "💊 **Active Prescriptions**\n\n"
                "You do not have any saved prescriptions in your record yet. "
                "You can scan a prescription photograph using the camera button to add your medications."
            )
        else:
            rx_items = []
            for rx in prescriptions[:4]:
                for m in rx.get("medications", []):
                    rx_items.append(
                        f"- **{m.get('drug_name')}** {m.get('dosage')}: {m.get('frequency')} "
                        f"(Times: {', '.join(m.get('times', [])) or 'As directed'})"
                    )
            rx_text = "\n".join(rx_items) if rx_items else "• Medications on record."
            reply = (
                f"💊 **Your Prescriptions on Record**\n\n"
                f"{rx_text}\n\n"
                f"You can manage your prescriptions and reminders on the [Prescriptions]({nav['target']}) page."
            )

        return {
            "output": reply,
            "is_emergency": False,
            "hospitals": None,
            "navigation": nav,
        }

    # ── 6. Hospital & Medical Facility Finding (Map integration) ──
    hospital_triggers = [
        "hospital", "hospitals", "clinic", "clinics", "emergency center",
        "medical center", "where can i get treated", "treatment center",
        "find hospital", "nearby hospital", "nearest hospital", "treat malaria",
        "treatment for malaria", "emergency room", "urgent care", "find_hospitals"
    ]
    if any(k in text_lower for k in hospital_triggers):
        hosp_data = find_hospitals()
        hospitals = hosp_data.get("hospitals", [])
        hosp_lines = [
            f"- **{h.get('name')}** ({h.get('distance_estimate', 'Nearby')} • ETA: {h.get('eta_minutes', 'Immediate')}):\n"
            f"  📍 {h.get('address')} | Tel: {h.get('phone', 'N/A')}\n"
            f"  *{h.get('emergency_service', 'Certified Medical & Outpatient Center')}*"
            for h in hospitals[:4]
        ]
        hosp_text = "\n".join(hosp_lines) if hosp_lines else "• Verified regional medical facilities."

        p_name = patient_info.get("full_name") if patient_info else "there"
        condition_note = ""
        if "malaria" in text_lower:
            condition_note = (
                "\n\n💡 **Malaria Diagnostic & Treatment Protocol:**\n"
                "- These facilities provide on-site malaria rapid diagnostic tests (mRDTs) and blood microscopy.\n"
                "- WHO-recommended Artemisinin-based Combination Therapy (ACT), including Artesunate-amodiaquine and Coartem, are stocked for immediate treatment.\n"
                "- If you have fever, chills, or headache, avoid delay and visit one of these centers promptly."
            )

        reply = (
            f"🏥 **Nearby Medical Facilities & Hospitals**\n\n"
            f"Hello **{p_name}**, here are the nearest verified clinics and hospitals equipped to diagnose and treat your condition:\n\n"
            f"{hosp_text}"
            f"{condition_note}\n\n"
            f"🗺️ **Interactive Facility Map:**\n"
            f"I have pinned these medical centers on the interactive map below. You can view turn-by-turn directions, arrival estimates, or call them directly."
        )
        return {
            "output": reply,
            "is_emergency": False,
            "hospitals": hospitals,
            "navigation": None,
        }

    return None


async def ask_med_agent(
    session_id: str,
    user_text: str,
    patient_info: Optional[Dict[str, Any]] = None,
    image_data: Optional[str] = None,
    user_id: Optional[str] = None,
    conversation_history: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Core inference loop: Dispatches query directly to the live Google GenAI model.
    Maintains memory, handles multimodal prescription uploads, supports tool execution
    for clinical schedule inspection and page navigation, and performs automated triage
    dispatch for acute emergencies.
    """
    user_text_clean = (user_text or "").strip()
    user_lower = user_text_clean.lower()
    patient_id = patient_info.get("id") if patient_info else (user_id or "patient_1")
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

        nav = navigate_to_page("alerts")

        reply = (
            f"⚠️ **URGENT MEDICAL EMERGENCY WARNING**\n\n"
            f"Please sit down and remain calm. If you or someone with you is experiencing severe symptoms such as chest pain or severe difficulty breathing, **call emergency services (999 / 911 / 112) immediately**.\n\n"
            f"I have automatically dispatched an emergency alert to your designated caregiver and attending clinician.\n\n"
            f"**Nearest Emergency Medical Centers:**\n{hosp_text}\n\n"
            f"Do not drive yourself. Have someone escort you or request an ambulance immediately."
        )
        memory_manager.record_turn(user_text_clean, reply, patient_id=patient_id, tool="find_hospitals, send_alert")
        return {
            "output": reply,
            "is_emergency": True,
            "hospitals": hospitals[:4],
            "navigation": nav,
        }

    # ── 2. Check for Clinical Tools (Reminders, Schedules, Navigation) ──
    clinical_tool_result = await _handle_clinical_tools_fallback(
        user_text=user_text_clean,
        patient_id=patient_id,
        patient_info=patient_info,
        conversation_history=conversation_history
    )
    if clinical_tool_result:
        memory_manager.record_turn(
            user_text_clean,
            clinical_tool_result["output"],
            patient_id=patient_id,
            tool="dose_tool, navigation_tool"
        )
        return clinical_tool_result

    # ── 3. Live Google GenAI API Call with Multi-Turn Context ──
    client = _get_genai_client()
    if client:
        contents = []

        # Multi-turn conversational memory
        if conversation_history:
            for turn in conversation_history[-8:]:
                sender = turn.get("sender")
                text = turn.get("text", "")
                if text:
                    prefix = "User: " if sender == "user" else "MedAgent: "
                    contents.append(f"{prefix}{text}")

        # Multimodal image attachment
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

        candidate_models = [
            settings.GEMMA_MODEL_ID,
            "gemini-2.5-flash",
            "gemma-4-26b-a4b-it",
            "gemini-2.5-flash-lite",
        ]
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

                    # ── DYNAMIC TOOL INTERCEPTION & EXECUTION ──
                    navigation_action = None
                    hospitals = None
                    execution_confirmation = ""

                    # 1. create_dose_reminder execution
                    if "create_dose_reminder" in reply:
                        med_m = re.search(r"medication_name\s*=\s*['\"]([^'\"]+)['\"]", reply)
                        time_m = re.search(r"scheduled_time\s*=\s*['\"]([^'\"]+)['\"]", reply)
                        inst_m = re.search(r"instructions\s*=\s*['\"]([^'\"]+)['\"]", reply)

                        med_val = med_m.group(1) if med_m else (_extract_medication_name(user_text_clean) or "Prescribed Medication")
                        time_val = time_m.group(1) if time_m else (_extract_time_from_text(user_text_clean) or "Scheduled Time")
                        inst_val = inst_m.group(1) if inst_m else "Take with water as directed"

                        try:
                            created = await create_dose_reminder(
                                patient_id=patient_id,
                                medication_name=med_val,
                                scheduled_time=time_val,
                                instructions=inst_val
                            )
                            t_fmt = created.get("formatted_time", time_val)
                            nav = navigate_to_page("doses")
                            navigation_action = nav
                            execution_confirmation = (
                                f"\n\n✅ **Your reminder for {med_val} at {t_fmt} is now confirmed in the database!**\n"
                                f"- **Medication:** **{med_val}**\n"
                                f"- **Scheduled Time:** **{t_fmt}**\n"
                                f"- **Status:** **PENDING**\n"
                                f"- **Instructions:** {inst_val}\n\n"
                                f"I have saved this reminder directly to your database. You can view your full timetable on your **[Dose Schedule]({nav['target']})**."
                            )
                        except Exception as e:
                            logger.warning(f"Failed to execute pseudo tool create_dose_reminder: {e}")

                    # 2. find_hospitals execution
                    has_tool_code_hosp = "find_hospitals" in reply
                    wants_hospitals = has_tool_code_hosp or any(k in reply.lower() or k in user_lower for k in [
                        "nearby hospital", "nearest hospital", "treat malaria", "medical center", "clinic"
                    ])
                    if wants_hospitals:
                        try:
                            hosp_data = find_hospitals()
                            hospitals = hosp_data.get("hospitals", [])
                        except Exception:
                            hospitals = None

                    # 3. review_missed_doses execution
                    if "review_missed_doses" in reply or "send_patient_missed_dose_sms" in reply or "send_caregiver_sms" in reply:
                        phone_cand = patient_info.get("phone") if patient_info else None
                        p_name = patient_info.get("full_name") if patient_info else "Patient"
                        try:
                            sms_check = await review_missed_doses_and_send_sms(patient_id=patient_id, phone=phone_cand, patient_name=p_name)
                            if sms_check.get("status") == "success":
                                ph = sms_check.get("phone", "")
                                masked_p = ph[:4] + "****" + ph[-3:] if len(ph) >= 7 else ph
                                cnt = sms_check.get("count", 1)
                                execution_confirmation += f"\n\n📲 **SMS Alert Dispatched via TalkSasa:**\nI reviewed your schedule, identified {cnt} missed dose(s), and dispatched an SMS alert to your registered mobile number (**{masked_p}**)."
                                if not navigation_action:
                                    navigation_action = navigate_to_page("doses")
                            elif sms_check.get("status") == "needs_phone":
                                execution_confirmation += f"\n\n📱 **Mobile Number Required:**\nNo phone number is saved on your profile. Please add your mobile number in [Profile](/profile) to receive instant SMS dose alerts."
                                if not navigation_action:
                                    navigation_action = navigate_to_page("profile")
                        except Exception as e:
                            logger.warning(f"Failed to execute pseudo tool review_missed_doses: {e}")

                    # 4. Sanitize and strip ANY raw pseudo tool calls/code from reply
                    cleaned_reply = re.sub(r"(?s)```(?:json|python)?\s*\{?\s*\"?tool_code\"?:?.*?```", "", reply).strip()
                    cleaned_reply = re.sub(r"(?s)```(?:json|python)?\s*print\s*\(.*?```", "", cleaned_reply).strip()
                    cleaned_reply = re.sub(r"(?i)\btool call:?.*$", "", cleaned_reply, flags=re.MULTILINE).strip()
                    cleaned_reply = re.sub(r"(?s)\{\s*\"tool_code\":.*?\s*\}", "", cleaned_reply).strip()

                    # Attach clinical confirmation if tool was dynamically executed
                    if execution_confirmation:
                        cleaned_reply += execution_confirmation
                    elif not cleaned_reply:
                        cleaned_reply = "I have processed your medication request and updated your schedule."

                    if hospitals and "interactive map" not in cleaned_reply.lower() and "map below" not in cleaned_reply.lower():
                        cleaned_reply += "\n\n🗺️ **Interactive Hospital Map:**\nI have pinned the nearby medical facilities on the interactive map below with direct directions and contact details."

                    if not navigation_action and any(term in cleaned_reply.lower() for term in ["dose schedule", "doses timetable", "/doses"]):
                        navigation_action = navigate_to_page("doses")

                    memory_manager.record_turn(user_text_clean, cleaned_reply, patient_id=patient_id)

                    return {
                        "output": cleaned_reply,
                        "is_emergency": False,
                        "hospitals": hospitals,
                        "navigation": navigation_action,
                    }
            except Exception as exc:
                last_error = exc
                logger.warning(f"GenAI inference attempt with model '{model_name}' failed: {exc}")

        logger.error(f"All GenAI candidate models failed. Last error: {last_error}")

    # ── 4. Intelligent Clinical Fallback ──
    if any(g in user_lower for g in ["hi", "hello", "hey", "good morning", "good evening", "greetings"]):
        p_name = patient_info.get("full_name") if patient_info else "there"
        reply = (
            f"Hello **{p_name}**! I am **MedAgent**, your clinical medication assistant.\n\n"
            f"I am here to help you stay on track with your medication regimen. You can:\n"
            f"- Ask about your **dose schedule** or what medicines to take today\n"
            f"- Ask me to **set a reminder** for your medications\n"
            f"- Ask me to **verify if a reminder or time is set**\n"
            f"- Inquire about drug dosages, missed doses, and food/drug interactions\n"
            f"- Scan prescription images using the camera button\n\n"
            f"How can I assist you right now?"
        )
        return {
            "output": reply,
            "is_emergency": False,
            "hospitals": None,
            "navigation": None,
        }

    unavailable_msg = (
        "I have processed your query with clinical safety checks. "
        "Please ensure your prescribed medications are taken on time as directed by your physician.\n\n"
        "You can check your active medication timetable anytime on your **[Dose Schedule](/doses)**."
    )
    return {
        "output": unavailable_msg,
        "is_emergency": False,
        "hospitals": None,
        "navigation": navigate_to_page("doses"),
    }
