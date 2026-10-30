# Smart Medication Reminder

> An AI-powered medication management platform connecting patients, caregivers, and doctors through intelligent reminders, real-time alerts, and agentic medical intelligence.

---

## Problem Statement

Medication non-adherence is one of the most persistent and costly challenges in modern healthcare. An estimated **50% of patients with chronic illnesses** do not take their medications as prescribed, contributing to approximately **125,000 preventable deaths** and over **$300 billion in avoidable healthcare costs** annually in the United States alone. The problem is compounded across multiple dimensions:

**For Patients:**
Patients — particularly the elderly, those managing multiple chronic conditions, or individuals with low health literacy — struggle to keep track of complex medication schedules involving multiple drugs, varying dosages, and time-sensitive administration windows. Prescription labels are often confusing, side effects go unrecognized, and there is no accessible channel to ask questions between doctor visits. When a patient does miss a dose, they are typically unaware of whether to skip it, double up, or seek help.

**For Caregivers:**
Family members and professional caregivers responsible for a patient's medication adherence have no reliable, real-time visibility into whether doses have been taken. They depend on manual check-ins, phone calls, or physical presence — all of which are unsustainable, especially across distances or multiple patients. There is no centralized system that surfaces alerts proactively when a patient misses a dose or reports a new symptom.

**For Doctors:**
Physicians operate with limited between-visit insight into how patients are actually adhering to prescribed treatments. They receive no structured data about missed doses, self-reported symptoms, or how a patient's condition is evolving day-to-day. Prescription decisions made in a 15-minute consultation window are effectively blind to the patient's real-world behavior. Doctors also lack a way to quickly locate nearby emergency facilities relevant to a patient's location during acute episodes.

**The Gap in Existing Tools:**
Current reminder apps are static — they send a notification at a scheduled time and nothing more. They do not understand the patient's medications, cannot answer follow-up questions, do not notify caregivers or doctors, cannot parse a prescription photo, and have no ability to reason across a patient's history. They are alarms, not intelligent health assistants.

---

## Solution

**Smart Medication Reminder** is a full-stack, AI-first healthcare platform that addresses every layer of the medication adherence problem through a single, intelligent AI agent that understands context, acts autonomously, and keeps all stakeholders in the loop.

**Intelligent Prescription Intake:**
Rather than requiring patients to manually enter drug names, dosages, and schedules, the platform accepts a photo of the prescription or pill bottle. The AI agent parses the image using multimodal Gemma, extracts the structured medication data (drug name, dosage, frequency, duration), and automatically configures the patient's reminder schedule. Patients can also describe their medications in plain language, and the agent will handle the rest.

**Conversational AI for Patients:**
Patients interact with a conversational AI interface that can answer questions about their medications — what a drug does, what side effects to watch for, whether it can be taken with food, what to do if a dose is missed, and whether two medications they are taking have known interactions. The agent searches up-to-date medical sources to ensure accuracy and never fabricates clinical information. This removes the dependency on a doctor visit for routine medication questions.

**Smart, Context-Aware Alerts:**
Reminders are not generic push notifications. Each alert is contextualized — it tells the patient which medication is due, the correct dose, and any relevant notes (e.g., "take with food", "avoid direct sunlight"). If a dose is missed and unacknowledged within a configurable window, the system escalates: the caregiver is notified with the patient's adherence status, and if the patient has also reported symptoms, a structured alert is sent to the doctor summarizing the situation.

**Caregiver Dashboard:**
Caregivers have a dedicated interface showing the real-time adherence status of every patient under their care. They receive push notifications for missed doses and symptom reports. The dashboard provides a shared view of the patient's current medication schedule, recent adherence history, and any AI-flagged concerns — removing the need for constant manual check-ins.

**Doctor Intelligence Layer:**
The AI agent compiles structured, narrative health summaries for doctors — aggregating adherence data, patient-reported symptoms, and trend analysis into readable reports. Doctors receive alerts only when clinically relevant (e.g., a patient reporting chest pain or a pattern of consistent non-adherence to a critical medication). The doctor dashboard supports prescription management: reviewing current medications, issuing updates, and viewing the AI-generated patient summaries.

**Location-Aware Emergency Support:**
In situations where a patient reports acute symptoms, the AI agent uses Google Maps to identify nearby hospitals, urgent care centers, or pharmacies — including distance, estimated travel time, and contact information. This is surfaced directly in the patient's interface and included in the alert sent to the doctor.

**Persistent, Learning Memory:**
The agent maintains a dual memory system. Short-term memory preserves active session context — the current conversation, the medication being discussed, and the last action taken. Long-term memory stores the patient's history, adherence patterns, preferences, and prior interactions in a vector-indexed archive that the agent can semantically search. Over time, the agent learns each patient's habits and tailors its responses and alerts accordingly.

---

## Architecture

```
+-----------------------------------------------------------+
|              React + TypeScript Frontend                   |
|   +----------+   +----------------+   +-----------------+ |
|   |  Patient  |   |   Caregiver    |   |     Doctor      | |
|   |    UI     |   |   Dashboard    |   |   Dashboard     | |
|   +----------+   +----------------+   +-----------------+ |
+---------------------------+-------------------------------+
                            |  REST / WebSocket
+---------------------------v-------------------------------+
|                      FastAPI Backend                       |
|   +----------------------------------------------------+  |
|   |         MedAgent  --  Single LlmAgent (ADK)        |  |
|   |                                                    |  |
|   |   +---------------+   +------------------------+  |  |
|   |   |  Gemma Model  |   |     Tool Registry      |  |  |
|   |   |  (Multimodal) |   |  parse_prescription    |  |  |
|   |   |               |   |  search_web            |  |  |
|   |   |  google-adk   |   |  find_hospitals        |  |  |
|   |   |  google-genai |   |  send_alert            |  |  |
|   |   +---------------+   |  write_summary         |  |  |
|   |                       |  recall_memory         |  |  |
|   |                       |  remember_patient      |  |  |
|   |                       +------------------------+  |  |
|   |                                                    |  |
|   |   +------------------------------------------------+  |
|   |   |            Dual Memory System                  |  |
|   |   |  Short-Term  (session buffer, last N turns)    |  |
|   |   |  Long-Term   (vector archive, MongoDB)         |  |
|   |   +------------------------------------------------+  |
|   +----------------------------------------------------+  |
|   +------------+  +--------------+  +----------------+   |
|   |  Auth API  |  |  Alerts API  |  |  Prescription  |   |
|   | (JWT)      |  |  (push/WS)   |  |     API        |   |
|   +------------+  +--------------+  +----------------+   |
+---------------------------+-------------------------------+
                            |
         +-----------------v------------------+
         |              MongoDB               |
         |  users . prescriptions . reminders |
         |  alerts . sessions . memory_archive|
         +------------------------------------+

External Integrations
  Google Maps Platform   (nearby hospitals, routing)
  Google GenAI / Gemma   (LLM inference, multimodal)
  Internet Search Tool   (drug info, medical guidelines)
```

---

## AI Agent System

The agent follows the **single `LlmAgent` pattern** — one root agent powered by Gemma that owns all tools and a dual memory system, served through FastAPI. There are no sub-agents. All reasoning, tool selection, memory retrieval, and alert dispatch happen within the one agent's agentic loop.

### Agent Definition

```python
from google.adk.agents import LlmAgent
from google.adk.apps import App
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService

med_agent = LlmAgent(
    name="med_agent",
    model="gemma-3-27b-it",
    description="Smart Medication Reminder Agent — multimodal healthcare assistant.",
    instruction=get_agent_instruction(),   # dynamically injects memory + session state
    tools=[
        parse_prescription,   # image/text -> structured Rx (drug, dose, frequency)
        search_web,           # drug info, interactions, medical guidelines
        find_hospitals,       # Google Maps Places API — nearby hospitals + ETA
        send_alert,           # push/WebSocket alert to patient | caregiver | doctor
        write_summary,        # compile and persist patient health summary for doctor
        recall_memory,        # semantic vector search over patient long-term history
        remember_patient,     # persist preferences, adherence, habits to long-term memory
    ],
)

app = App(name="smart_med_reminder", root_agent=med_agent)
```

### Dual Memory System

| Layer | Storage | Purpose |
|---|---|---|
| Short-Term | In-memory session buffer (last N turns) | Active conversation context, current medication topic, last alert sent |
| Long-Term | MongoDB vector archive | Patient history, adherence patterns, doctor summaries, learned habits |

The agent's instruction is rebuilt dynamically at every request, injecting:
- Current date and time
- Active patient session state (role, linked caregiver/doctor, active prescription)
- Semantically relevant long-term memories (cosine similarity retrieval)
- Recent conversation turns (sliding window)

### Agentic Loop

```
User input (text or camera image)
         |
         v
   MedAgent (LlmAgent)
   +-------------------------------------------+
   |  1. UNDERSTAND   parse role, intent,       |
   |                  active prescription       |
   |  2. PLAN & ACT   select and call tools     |
   |                  (parse Rx, search, alert) |
   |  3. OBSERVE      evaluate tool output,     |
   |                  retry on failure          |
   |  4. REMEMBER     record turn short-term,   |
   |                  archive to long-term      |
   |  5. RESPOND      natural language reply    |
   |                  + dispatched alerts       |
   +-------------------------------------------+
         |
         +---> Patient / Caregiver:  "Time for your 8 AM Metformin dose"
         +---> Doctor:               "Patient reported chest pain (severity 7/10)"
```

### Tool Registry

| Tool | Purpose |
|---|---|
| `parse_prescription` | Extracts drug name, dosage, frequency, duration from an image or plain text |
| `search_web` | Retrieves up-to-date drug information, interaction warnings, and medical guidelines |
| `find_hospitals` | Queries Google Maps Places API for nearby hospitals, urgent care, and pharmacies |
| `send_alert` | Dispatches push notification or WebSocket alert to a patient, caregiver, or doctor |
| `write_summary` | Compiles and persists a structured patient health summary for the doctor dashboard |
| `recall_memory` | Performs semantic vector search over the patient's long-term history archive |
| `remember_patient` | Saves patient preferences, adherence notes, and habits to long-term memory |

### FastAPI Server Entrypoint

```python
@app.post("/chat")
async def invoke_agent(payload: ChatPayload):
    session_id = await get_or_create_session(payload.session_id)
    reply = await ask_agent(runner, session_id, payload.input, payload.image)
    return {"output": reply, "session_id": session_id}
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js, TypeScript, Tailwind CSS, React Router |
| Backend | Python 3.11+, FastAPI, Uvicorn |
| AI Agent | Google Gemma (multimodal), google-adk, google-genai |
| Agent Pattern | Single LlmAgent with tool registry and dual memory |
| Agent Tools | MCP (Model Context Protocol) tools |
| Storage | MongoDB via Motor async driver |
| Auth | JWT access and refresh tokens, bcrypt |
| Maps | Google Maps Platform — Places API, Directions API |
| Notifications | WebSockets and push notifications |

---

## Project Structure

```
smart-medication-reminder/
├── README.md
├── .env.example
├── backend/
│   ├── main.py                      # FastAPI entry point
│   ├── requirements.txt
│   ├── core/
│   │   ├── config.py                # Settings and environment variables
│   │   ├── security.py              # JWT auth helpers
│   │   └── database.py              # MongoDB connection via Motor
│   ├── agent/
│   │   ├── agent.py                 # LlmAgent definition, App, Runner
│   │   ├── server.py                # FastAPI /chat and /invoke endpoints
│   │   ├── memory/
│   │   │   ├── memory_manager.py    # Dual memory: short-term buffer + long-term vector archive
│   │   │   ├── short_term.json      # Session buffer (auto-managed)
│   │   │   └── long_term.json       # Persistent patient archive (auto-managed)
│   │   ├── context/
│   │   │   ├── personality.md       # Agent tone and communication style
│   │   │   └── about.md             # Agent identity context injected into instruction
│   │   └── tools/
│   │       ├── __init__.py          # Tool exports
│   │       ├── prescription.py      # parse_prescription
│   │       ├── maps_tool.py         # find_hospitals
│   │       ├── web_tool.py          # search_web
│   │       ├── alert_tool.py        # send_alert
│   │       ├── summary_tool.py      # write_summary
│   │       └── memory_tools.py      # recall_memory, remember_patient
│   ├── routers/
│   │   ├── auth.py                  # /auth — register, login, refresh
│   │   ├── patients.py              # /patients — CRUD and interactions
│   │   ├── prescriptions.py         # /prescriptions — upload, parse, manage
│   │   ├── reminders.py             # /reminders — schedule, snooze, history
│   │   ├── alerts.py                # /alerts — send, list, acknowledge
│   │   ├── caregivers.py            # /caregivers — link patient, dashboard
│   │   └── doctors.py               # /doctors — summaries, patient list
│   ├── models/
│   │   ├── user.py
│   │   ├── prescription.py
│   │   ├── reminder.py
│   │   └── alert.py
│   └── services/
│       ├── scheduler.py             # APScheduler — timed reminders
│       ├── notification.py          # Push and WebSocket dispatch
│       └── image_processor.py       # Pre-process camera images before agent intake
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── public/
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── vite-env.d.ts
│       ├── types/
│       │   └── index.ts             # Shared TypeScript interfaces
│       ├── pages/
│       │   ├── Auth/
│       │   │   ├── Login.tsx
│       │   │   └── Register.tsx
│       │   ├── Patient/
│       │   │   ├── Dashboard.tsx
│       │   │   ├── Chat.tsx         # AI interaction — text and image input
│       │   │   └── Reminders.tsx
│       │   ├── Caregiver/
│       │   │   ├── Dashboard.tsx
│       │   │   └── PatientView.tsx
│       │   └── Doctor/
│       │       ├── Dashboard.tsx
│       │       ├── PatientSummary.tsx
│       │       └── Prescriptions.tsx
│       ├── components/
│       │   ├── Navbar.tsx
│       │   ├── ReminderCard.tsx
│       │   ├── AlertBadge.tsx
│       │   ├── CameraCapture.tsx    # MediaDevices API for prescription photo capture
│       │   └── MapView.tsx          # Google Maps embed for hospital search
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   └── useWebSocket.ts
│       └── services/
│           └── api.ts               # Axios base client with TypeScript types
```

---

## Getting Started

### Prerequisites

| Tool | Minimum Version |
|---|---|
| Node.js | 18 |
| Python | 3.11 |
| MongoDB | 7.0 (local or Atlas) |
| Google Cloud account | Maps API and Gemini/Gemma access enabled |

### Backend Setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Copy the environment variable template and fill in your values
cp ../.env.example .env

# Start the development server
uvicorn main:app --reload --port 8000
```

API base URL: `http://localhost:8000`  
Interactive API docs: `http://localhost:8000/docs`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

App URL: `http://localhost:5173`

---

## Environment Variables

Create a `.env` file in the `backend/` directory using `.env.example` as a reference:

```dotenv
# Application
APP_ENV=development
SECRET_KEY=your-secret-key-here

# MongoDB
MONGODB_URI=mongodb://localhost:27017/smart_med_reminder

# Google AI
GOOGLE_API_KEY=your-google-genai-api-key
GEMMA_MODEL_ID=gemma-3-27b-it

# Google Maps
GOOGLE_MAPS_API_KEY=your-maps-api-key

# JWT
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Notifications
PUSH_NOTIFICATION_KEY=your-push-key
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register a new user as patient, caregiver, or doctor |
| POST | `/auth/login` | Authenticate and receive a JWT |
| GET | `/patients/me` | Retrieve the current patient's profile |
| POST | `/prescriptions/upload` | Upload a prescription image or text for AI parsing |
| GET | `/prescriptions/{id}` | Retrieve a parsed prescription |
| GET | `/reminders` | List all upcoming reminders for the current user |
| POST | `/reminders/{id}/snooze` | Snooze a scheduled reminder |
| POST | `/chat` | Send a text message or image to the AI agent |
| GET | `/alerts` | List all alerts for the current user |
| GET | `/doctors/patients` | Retrieve all patients linked to the authenticated doctor |
| GET | `/doctors/patients/{id}/summary` | Retrieve the AI-generated health summary for a patient |
| GET | `/maps/hospitals` | Query nearby hospitals by latitude and longitude |

---

## Contributing

Contributions are welcome for Hacktoberfest.

1. Fork this repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit using Conventional Commits: `git commit -m "feat: add your feature"`
4. Push the branch: `git push origin feat/your-feature`
5. Open a Pull Request against `main`

Please follow the [Conventional Commits](https://www.conventionalcommits.org/) specification and check `CONTRIBUTING.md` for detailed guidelines.

### Good First Issues

- Add a medication interaction checker tool to the agent
- Implement the caregiver-to-patient linking flow
- Add dark mode support to the frontend
- Write unit tests for the prescription parser tool
- Add multi-language support (i18n)

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

Built for Hacktoberfest — Smart Medication Reminder. Never miss a dose again.
