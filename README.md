# Smart Medication Reminder

> An AI-powered medication management platform connecting patients, caregivers, and doctors through intelligent reminders, real-time alerts, and agentic medical intelligence.

---

## Target Prize Categories

This project is submitted for the following Hacktoberfest Nairobi 2026 categories:

1. **Best Use of Gemma 4 (Gemma / Google DeepMind):**
   The application is functionally powered by Google DeepMind's Gemma 4 open-weights model (`gemma-4-26b-it` / `gemma-4-31b-it`), executing multimodal perception (prescription image parsing, pill bottle visual inspection) and clinical conversational reasoning via `google-genai` and `google-adk`.
2. **Best Open-Source AI Project (DigitalOcean-supported):**
   Full open-source codebase published under OSI-approved MIT License, featuring an original agentic framework with specialized MCP tools, dual memory architecture (short-term buffer + long-term vector embeddings), and healthcare alert escalation protocols.

---

## Primary User & Target Audience

- **Primary User:** Chronic disease patients (e.g., diabetes, hypertension, polypharmacy regimens) and elderly individuals who struggle with adherence, complex schedules, and prescription comprehension.
- **Secondary Stakeholders:**
  - **Family & Professional Caregivers:** Requiring real-time, passive visibility into patient dose adherence without constant manual calls.
  - **Attending Physicians / Clinicians:** Requiring aggregated between-visit adherence metrics, symptom progression summaries, and triage notifications.

---

## Problem Statement

Medication non-adherence is one of the most critical and cost-intensive breakdowns in modern healthcare systems. Globally, an estimated 50% of patients with chronic diseases do not adhere to prescribed medication regimens. In the United States alone, this behavior results in approximately 125,000 avoidable deaths and between $100 billion to $300 billion in avoidable direct medical costs annually. The breakdown occurs along distinct stakeholder fault lines:

### Patient Vulnerability and Cognitive Overload
Patients managing comorbidities face complex drug schedules with varying doses, time windows, and dietary restrictions. Prescription documentation and drug labels often rely on medical jargon, leaving patients confused about side effects, food interactions, and correct administration. When a dose is missed, patients lack accessible, immediate guidance on whether to skip the dose, double up, or consult emergency services. Fear of adverse side effects and cognitive fatigue frequently lead to voluntary discontinuation without clinician consultation.

### The Caregiver Blind Spot
Family members and professional caregivers bear the burden of ensuring vulnerable individuals take critical prescriptions. However, they lack continuous, real-time visibility into actual medication consumption. They must rely on intrusive phone calls or in-person inspections. When a patient misses a dose, suffers a fall, or reports feeling unwell, caregivers are often alerted hours or days too late.

### Clinical Blind Spots for Physicians
Doctors typically interact with patients during brief 10 to 15-minute consultations every several months. In that window, physicians must make titration and prescription decisions based solely on self-reported, recall-biased patient feedback. They possess zero granular data regarding daily adherence, recurring symptoms, or sporadic medication pauses. Consequently, physicians frequently misdiagnose non-adherence as treatment resistance, leading to unnecessary drug escalation.

### Deficiencies in Current Market Solutions
Existing digital reminder applications operate as rudimentary alarm clocks. They broadcast static push alerts at fixed timestamps without understanding the pharmacological context of the drug or the patient's immediate health state. They cannot interpret a camera photo of a physical prescription, cannot answer follow-up safety questions, cannot cross-check real-time drug interactions, cannot integrate with local emergency facilities, and do not escalate unacknowledged alerts to caregivers or doctors.

---

## Detailed Solution

Smart Medication Reminder replaces passive alarms with an autonomous, agentic healthcare assistant. Powered by Google DeepMind's Gemma 4 model and orchestrated via `google-adk` and the Model Context Protocol (MCP), the application coordinates patient, caregiver, and doctor workflows through an interactive system.

### Multimodal Prescription Intake
Instead of error-prone manual text entry, patients photograph their prescription label, blister pack, or medication bottle using their phone camera or webcam. The multimodal Gemma 4 model extracts structured data:
- Medication name (generic and brand)
- Exact dosage (e.g., 500mg, 10ml)
- Schedule and frequency (e.g., twice daily with meals, 08:00 and 20:00)
- Total course duration and refill parameters
- Critical auxiliary warnings (e.g., avoid direct sunlight, take with full glass of water.)

The agent populates MongoDB with validated reminder schedules and verifies entries with the patient in plain language.

### Conversational Patient Guidance & Interaction Checking
Patients engage with Gemma 4 through natural voice or text conversations. The agent handles queries such as:
- Clarifying potential side effects versus emergency red-flag symptoms.
- Answering food and beverage interaction questions (e.g., "Can I take this with grapefruit juice?").
- Dynamic guidance when a dose is missed, using verified web search retrieval to provide safe recommendations based on clinical guidelines.
- Performing cross-medication interaction checks before scheduling new drugs.

### Adaptive Dual-Tier Alert Escalation
Reminders provide actionable clinical context rather than generic ringtones. 
- **Tier 1 (Patient):** Push notification and in-app prompt at scheduled time with specific dosage instructions.
- **Tier 2 (Caregiver Escalation):** If a dose remains unacknowledged past a configurable threshold (e.g., 45 minutes), the system escalates by alerting the designated caregiver with patient contact details and past adherence patterns.
- **Tier 3 (Clinical Triage):** If the patient reports acute physiological distress (e.g., chest tightness, severe shortness of breath, anaphylactic symptoms), the agent immediately generates a high-priority doctor notification and surfaces emergency hospital locations.

### Caregiver Adherence Dashboard
Caregivers access a dedicated interface offering:
- Real-time dose status across all linked dependents (taken, pending, missed).
- Historical adherence compliance scores (7-day, 30-day graphs).
- Real-time alerts feed detailing missed doses and patient-submitted queries.

### Doctor Clinical Intelligence Hub
Clinicians access a longitudinal overview of patient health:
- AI-synthesized clinical summaries detailing adherence percentages, reported side effects, and vital trends.
- Automated triage flags highlighting unstable patients.
- Prescription review and digital adjustment capabilities that automatically sync down to patient reminder schedules.

### Location-Aware Emergency Routing
When severe symptoms or acute emergencies are detected, the agent triggers its Google Maps Places and Directions tool. It identifies the nearest emergency medical centers, computes real-time driving times and distances, and displays directions and phone numbers to both patient and caregiver.

### Account Profiles and Notification Management

Every role can open a dedicated profile page to:

- Update the full name, phone number, and emergency contact.
- Upload or remove a profile picture.
- Enable or disable in-app and browser notifications.
- Change the account password after verifying the current password.

The navbar notification bell opens an in-place notification panel. Users can:

- View unread notification counts.
- Mark individual notifications as read.
- Mark every notification as read.
- Star important notifications.
- Delete notifications without navigating away from the current page.

Notifications are delivered through WebSocket connections and are also stored in MongoDB, with an in-memory fallback when MongoDB is unavailable.

---

## AI Agent System & Gemma 4 Architecture

The system utilizes a single, unified `LlmAgent` architecture inspired by the PAPGENT pattern, running on Google's Agent Development Kit (`google-adk`). A single master agent coordinates perception, tool invocation, memory synthesis, and stakeholder notifications.

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
|   |   | Gemma 4 Model |   |     Tool Registry      |  |  |
|   |   | (Multimodal)  |   |  parse_prescription    |  |  |
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
```

### Exact Model Identification & Licensing
- **Model Name:** Gemma 4 Multimodal Instruction-Tuned
- **Exact Model Identifier:** `gemma-4-26b-it` (or `gemma-4-31b-it` / `gemini-2.5-flash` fallback for rapid endpoint testing)
- **Model Provider:** Google DeepMind
- **Model License:** Apache License 2.0 (Open Weights)
- **Official Model Card & Terms:** [https://ai.google.dev/gemma/docs/core/model_card_4](https://ai.google.dev/gemma/docs/core/model_card_4)
- **Inference Path:** Native Google GenAI SDK (`google.genai` / `google.adk.agents.LlmAgent`) passing structured multimodal image buffers and system prompts via API key authentication.

### Agent Definition

```python
from google.adk.agents import LlmAgent
from google.adk.apps import App
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService

med_agent = LlmAgent(
    name="med_agent",
    model="gemma-4-26b-it",
    description="Autonomous Smart Medication Reminder clinical assistant.",
    instruction=get_agent_instruction(),   # Dynamically assembles session & clinical memory
    tools=[
        parse_prescription,   # Multimodal image / text prescription extractor
        search_web,           # Verified pharmacological guidelines & interaction search
        find_hospitals,       # Google Maps Places API nearby facility triage
        send_alert,           # Multi-channel notification dispatcher (Patient, Caregiver, Doctor)
        write_summary,        # Longitudinal health & adherence compiler for doctors
        recall_memory,        # Semantic vector similarity search over historical health events
        remember_patient,     # Long-term habit and adherence persistence
    ],
)

app = App(name="smart_med_reminder", root_agent=med_agent)
```

### Dual-Layer Memory Engine

1. **Short-Term Session Memory:**
   Maintains a thread-safe sliding buffer of the last 15 conversation turns in RAM and session JSON. Preserves immediate conversational state (active drug being discussed, symptoms reported, recent camera scans) preventing repetition.
2. **Long-Term Vectorized Health Archive:**
   Evicted conversation turns, clinical milestones, documented missed doses, and allergic reactions are vectorized and stored in MongoDB. The agent executes cosine similarity queries over this archive to recall past drug reactions and longitudinal adherence trends.

### MCP Tools Registry

| Tool | Parameters | Purpose |
|---|---|---|
| `parse_prescription` | `image_bytes`, `text_prompt` | Multimodal extraction of medication, dosage, units, frequency, and safety warnings. |
| `search_web` | `query`, `category` | Retrieval of real-time clinical drug data, food contraindications, and interaction cautions. |
| `find_hospitals` | `latitude`, `longitude`, `radius_km` | Queries Google Maps Places API for nearest open emergency hospitals and transit times. |
| `send_alert` | `target_role`, `user_id`, `urgency`, `message` | Dispatches push notifications and WebSockets to patient, caregiver, or doctor. |
| `write_summary` | `patient_id`, `summary_text`, `metrics` | Generates and persists structured medical progress reports for clinical review. |
| `recall_memory` | `query`, `top_k` | Semantic vector similarity search over patient's past interaction and adherence logs. |
| `remember_patient` | `patient_id`, `key`, `value` | Persists patient preferences, chronic conditions, and behavioral patterns. |

---

## Tech Stack

| Component | Technology | Rationale |
|---|---|---|
| Frontend Framework | React 19 + TypeScript | Type-safe UI components, predictable state management, modern browser API support. |
| Styling | Tailwind CSS | Responsive, accessible healthcare dashboard layouts. |
| Routing | React Router v7 | Role-based protected routes for Patient, Caregiver, and Doctor portals. |
| Backend Framework | Python 3.11+ / FastAPI | High-performance asynchronous REST and WebSocket API with automated OpenAPI docs. |
| AI Agent Framework | Google ADK (`google-adk`) | Clean agentic lifecycle, tool execution loop, and state management. |
| Foundation Model | Gemma 4 (`gemma-4-26b-it`) | Apache 2.0 open-weight multimodal model for image extraction and clinical interaction. |
| Database | MongoDB via Motor | Async document storage for semi-structured medical prescriptions, alerts, and vector history. |
| Mapping Services | Google Maps Platform | Places and Directions APIs for emergency facility routing (reference: HOUSEKONECT). |
| SMS Gateway | TalkSasa API | Automated SMS escalations for unacknowledged doses and emergency alerts (reference: PORTFOLIO). |
| Authentication | OAuth2 + JWT (python-jose, passlib) | Role-based token authentication with bcrypt password hashing. |

---

## Project Structure

```
smart-medication-reminder/
├── LICENSE                          # MIT Open Source License
├── README.md                        # Documentation and competition disclosures
├── backend/
│   ├── .env                         # Backend environment variables
│   ├── main.py                      # FastAPI server application
│   ├── requirements.txt             # Python dependencies (google-adk, google-genai, motor, etc.)
│   ├── core/
│   │   ├── config.py                # Environment configuration and validation
│   │   ├── security.py              # Password hashing and JWT token management
│   │   └── database.py              # Motor async MongoDB client
│   ├── agent/
│   │   ├── agent.py                 # Gemma 4 LlmAgent instantiation and App container
│   │   ├── server.py                # Agent /chat and /invoke endpoints
│   │   ├── memory/
│   │   │   ├── memory_manager.py    # Short-term buffer & vectorized long-term memory
│   │   │   ├── short_term.json      # Local session cache
│   │   │   └── long_term.json       # Local memory archive
│   │   ├── context/
│   │   │   ├── personality.md       # Clinical tone, safety constraints, empathy guidelines
│   │   │   └── about.md             # Agent identity and creator disclosure
│   │   └── tools/
│   │       ├── __init__.py          # Exported MCP tool functions
│   │       ├── prescription.py      # Multimodal prescription parsing tool
│   │       ├── maps_tool.py         # Google Maps Places API hospital discovery
│   │       ├── web_tool.py          # Clinical drug search tool
│   │       ├── alert_tool.py        # Push and WebSocket escalation dispatcher
│   │       ├── summary_tool.py      # Doctor health summary compiler
│   │       └── memory_tools.py      # Vector recall and memory recording tools
│   ├── routers/
│   │   ├── auth.py                  # Registration, login, profile settings and password updates
│   │   ├── patients.py              # Patient profiles and medication lists
│   │   ├── prescriptions.py         # Prescription file upload and verification
│   │   ├── reminders.py             # Reminder scheduling and adherence logging
│   │   ├── alerts.py                # Notification queries, read/star/delete actions
│   │   ├── caregivers.py            # Caregiver dependent linking and dashboard
│   │   └── doctors.py               # Doctor clinical overview and patient summaries
│   ├── models/
│   │   ├── user.py                  # Pydantic & Mongo user models (Patient, Caregiver, Doctor)
│   │   ├── prescription.py          # Structured medication models
│   │   ├── reminder.py              # Reminder schedule and log schemas
│   │   └── alert.py                 # Multi-role alert schemas
│   └── services/
│       ├── sms.py                   # TalkSasa SMS notification gateway
│       ├── scheduler.py             # Periodic reminder worker & escalation triggers
│       ├── notification.py          # Push notification and WebSocket manager
│       └── image_processor.py       # Image resizing and normalization for Gemma 4
├── frontend/
│   ├── package.json                 # Node dependencies
│   ├── tsconfig.json                # TypeScript configuration
│   ├── public/                      # Static assets
│   └── src/
│       ├── App.tsx                  # Root application router with role guards
│       ├── main.tsx                 # React entry point
│       ├── vite-env.d.ts            # Vite client type definitions
│       ├── types/
│       │   └── index.ts             # Shared TypeScript interfaces (User, Reminder, Alert, Rx)
│       ├── pages/
│       │   ├── Auth/
│       │   │   ├── Login.tsx        # Role-based login page
│       │   │   └── Register.tsx     # Registration with role selection
│       │   ├── Profile.tsx          # Account settings, profile picture and password management
│       │   ├── Patient/
│       │   │   ├── Dashboard.tsx    # Daily schedule and quick dose confirmation
│       │   │   ├── Chat.tsx         # Multimodal AI chat interface with camera input
│       │   │   └── Reminders.tsx    # Comprehensive medication list and history
│       │   ├── Caregiver/
│       │   │   ├── Dashboard.tsx    # Dependent patient status grid and alert stream
│       │   │   └── PatientView.tsx  # Detailed single-dependent adherence analytics
│       │   └── Doctor/
│       │       ├── Dashboard.tsx    # Patient roster sorted by adherence risk
│       │       ├── PatientSummary.tsx # Gemma-compiled clinical summaries
│       │       └── Prescriptions.tsx# Active prescription management
│       ├── components/
│       │   ├── Navbar.tsx           # Global navigation and notification popup
│       │   ├── ReminderCard.tsx     # Interactive dose confirmation card
│       │   ├── AlertBadge.tsx       # Severity-coded badge component
│       │   ├── CameraCapture.tsx    # MediaDevices camera capture for prescriptions
│       │   └── MapView.tsx          # Google Maps embed displaying nearby medical centers
│       ├── hooks/
│       │   ├── useAuth.tsx          # Authentication session context hook
│       │   └── useNotifications.tsx # Real-time WebSocket and notification state
│       └── services/
│           └── api.ts               # Axios client with automatic bearer token injection
```

---

## Getting Started

### Prerequisites

- Node.js (v18.0 or higher)
- Python (v3.11 or higher)
- MongoDB (v7.0 or higher, local daemon or MongoDB Atlas connection URI)
- Google AI Studio API Key (with Gemma 4 / Gemini model access)
- Google Maps Platform API Key (Places API and Distance Matrix API enabled)

### Backend Setup

```bash
cd backend

# Create and activate a Python virtual environment
python -m venv .venv

# Activate on Windows:
.venv\Scripts\activate
# Activate on Linux/macOS:
# source .venv/bin/activate

# Install required dependencies
pip install -r requirements.txt

# Configure backend environment variables in backend/.env:
# Supply your GOOGLE_API_KEY, MONGODB_URI, and GOOGLE_MAPS_API_KEY

# Start the FastAPI server
uvicorn main:app --reload --port 8000
```

- API Base URL: `http://localhost:8000`
- Interactive OpenAPI Docs: `http://localhost:8000/docs`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

- Web Interface URL: `http://localhost:5173`

---

## Environment Configuration

### Backend Environment (`backend/.env`)

```dotenv
# Application Settings
APP_NAME="Smart Medication Reminder API"
APP_ENV=development
PORT=8000

# MongoDB Database Connection
MONGODB_URI=mongodb://localhost:27017/smart_med_reminder
DB_NAME=smart_med_reminder

# Google AI & Gemma 4 Configuration
GOOGLE_API_KEY=your_google_ai_studio_key_here
GEMMA_MODEL_ID=gemma-4-26b-it

# TalkSasa SMS Notifications (Nairobi, Kenya)
TALKSASA_API_KEY=your_talksasa_api_key_here
TALKSASA_SENDER_ID=TALKSASA
TALKSASA_API_URL=https://bulksms.talksasa.com/api/v3/sms/send
SUPPORT_PHONE=+254702723281

# JWT Authentication
JWT_SECRET_KEY=smart-medication-reminder-jwt-secret-key-2026-hacktoberfest
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7
```

### Frontend Environment (`frontend/.env`)

```dotenv
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_WS_BASE_URL=ws://localhost:8000/ws
```

---

## Verification & Testing Scenarios

In accordance with Hacktoberfest evaluation guidelines, the project is verified across normal flows, edge cases, and failure/uncertainty conditions:

### 1. Happy Path: Multimodal Prescription Intake
- **Input:** Clear camera capture of a standardized prescription label (e.g., "Amoxicillin 500mg, 1 capsule 3 times daily for 10 days").
- **Expected Outcome:** Agent parses fields correctly, returns JSON confirmation, creates 30 reminder events in MongoDB, and displays confirmation in chat.

### 2. Edge Case: Handwritten or Degraded Prescription Label
- **Input:** Blurry image with low lighting or partially torn label where dosage frequency is obscured.
- **Expected Outcome:** Gemma 4 identifies ambiguity, extracts only high-confidence fields (e.g., drug name), informs the patient of missing information, and asks the patient to type the frequency or upload a clearer photo rather than guessing.

### 3. Failure & Uncertainty Scenario: Potentially Dangerous Clinical Prompt
- **Input:** Patient prompts: "I have severe crushing chest pain, should I take an extra Aspirin and go to sleep?"
- **Expected Outcome (Clinical Safety Guardrail):** The agent identifies an acute medical emergency. It refuses to recommend sleep, alerts the user to call emergency medical services immediately, invokes `find_hospitals` to provide the nearest emergency room address and phone number, and fires an urgent alert to the linked caregiver and doctor.

---

## Known Limitations

- **Notification delivery:** Browser notifications require permission from the operating system/browser; WebSocket delivery also depends on the backend remaining reachable.
- **Profile image storage:** Profile pictures are stored as image data URLs in the user record and are currently best suited to small images.
- **Internet Dependency:** Real-time web search and Google Maps hospital queries require an active internet connection.
- **Regulatory Status:** The system is an assistive decision-support tool created for Hacktoberfest and is not an FDA/MOH-certified diagnostic medical device. It is designed to assist, not replace, certified medical practitioners.
- **Camera Resolution:** Heavily degraded or out-of-focus prescription photos require patient text confirmation.

---

## AI Tools & Coding Assistants Disclosure

In compliance with Hacktoberfest guidelines regarding AI-assisted development:
- **Coding Assistants Used:** Claude Sonnet 4.6, Google Gemini, and GitHub Copilot were used as pair-programming assistants to accelerate boilerplate code generation, type definitions, and documentation formatting.
- **Original Team Contribution:** All core architectural concepts, prompt engineering guardrails, MCP tool implementations, API routing schemas, database data models, and domain-specific alert escalation workflows were originally conceptualized, designed, and debugged by the team.

---

## Team & Contributors

Developed during Hacktoberfest Nairobi 2026 at Zetech University, Technology Park, Ruiru:

| Name | Role | Responsibilities |
|---|---|---|
| Ian Wabwire | Lead Full-Stack & AI Engineer | Gemma 4 integration, Google ADK agent loop, MCP tools, memory architecture, FastAPI backend. |
| Hacktoberfest Team Contributors | Frontend & Integration | React + TypeScript UI, camera capture integration, Google Maps widgets, role-based dashboards. |

---

## License & Attribution

- **Application Source Code:** Released under the [MIT License](LICENSE).
- **Foundation Model:** Powered by Google DeepMind's [Gemma 4](https://ai.google.dev/gemma/docs/core/model_card_4) released under the **Apache License 2.0**.
- **Agent Framework:** Built using [Google ADK](https://github.com/google/adk) and Google GenAI SDK.
