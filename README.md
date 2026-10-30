# 💊 Smart Medication Reminder

> An AI-powered medication management platform connecting **patients**, **caregivers**, and **doctors** through intelligent reminders, real-time alerts, and agentic medical intelligence — built for Hacktoberfest.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Environment Variables](#environment-variables)
- [API Overview](#api-overview)
- [AI & Agentic System](#ai--agentic-system)
- [Hardware Reference](#hardware-reference)
- [Contributing](#contributing)
- [License](#license)

---

## 🌟 Overview

**Smart Medication Reminder** is a full-stack, AI-first healthcare assistant that ensures patients never miss a dose, keeps caregivers informed, and gives doctors real-time visibility into patient adherence and health trends.

At its core, a **Gemma-powered AI agent** handles natural language interactions, analyzes prescription images/text, compiles health summaries for doctors, and dispatches context-aware alerts across all roles — all orchestrated via the **Google ADK + MCP agentic framework**.

---

## ✨ Features

### 👤 Patient
- 📷 **Camera image input** — photograph pill bottles, blister packs, or prescriptions for automatic parsing
- 💬 **Text prompt interface** — ask the AI about dosage, side effects, drug interactions
- ⏰ **Smart reminders** — timely medication alerts with prescription context
- 📍 **Nearby hospitals** — location-aware search via Google Maps for emergency referrals

### 🧑‍🤝‍🧑 Caregiver Interface
- Real-time **adherence dashboard** for monitored patients
- Push **alerts** when a patient misses a dose or flags a concern
- Shared view of the patient's current medication schedule

### 🩺 Doctor Interface
- AI-compiled **patient health summaries** and adherence reports
- Automated **alerts on patient-reported symptoms** or anomalies
- Prescription management: review, update, and issue new prescriptions

### 🤖 AI Agent (Gemma)
- Multimodal understanding of **images + text** (prescription parsing, pill identification)
- Natural language **patient interactions** (symptom checking, medication Q&A)
- Intelligent **analysis & compilation** of patient data for doctor review
- Dispatches role-specific alerts: reminders to patients/caregivers, health flags to doctors
- **Web search** tool for up-to-date drug information and medical guidelines
- **Google Maps** integration to locate nearby hospitals and estimate travel time

### 🔐 Auth
- Secure **login / register** with role-based access control (Patient · Caregiver · Doctor)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      React Frontend                      │
│  ┌──────────┐  ┌───────────────┐  ┌──────────────────┐  │
│  │  Patient  │  │   Caregiver   │  │     Doctor       │  │
│  │    UI    │  │   Dashboard   │  │    Dashboard     │  │
│  └──────────┘  └───────────────┘  └──────────────────┘  │
└──────────────────────────┬──────────────────────────────┘
                           │  REST / WebSocket
┌──────────────────────────▼──────────────────────────────┐
│                   FastAPI Backend                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │             Agentic AI Core (ADK + MCP)           │   │
│  │  ┌─────────────┐   ┌────────────┐  ┌──────────┐  │   │
│  │  │ Gemma Model │   │ MCP Tools  │  │ GenAI SDK│  │   │
│  │  │ (Multimodal)│   │ (web, maps)│  │          │  │   │
│  │  └─────────────┘   └────────────┘  └──────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────┐   │
│  │  Auth API  │  │  Alerts API  │  │  Prescription  │   │
│  │ (JWT/OAuth)│  │ (push/email) │  │     API        │   │
│  └────────────┘  └──────────────┘  └────────────────┘   │
└──────────────────────────┬──────────────────────────────┘
                           │
        ┌──────────────────▼──────────────────┐
        │            MongoDB                   │
        │  users · prescriptions · reminders   │
        │  alerts · sessions · audit_logs      │
        └─────────────────────────────────────┘

External Integrations
  ├── Google Maps Platform  (nearby hospitals, routing)
  ├── Google GenAI / Gemma  (LLM inference)
  └── Internet Search Tool  (drug info, guidelines)
```

### Agentic Design

The AI layer follows an **agentic loop** pattern using `google-adk`:

1. **Perceive** — receive image/text from patient or scheduled trigger
2. **Plan** — decide which MCP tools to invoke (parse prescription, search drug DB, locate hospital)
3. **Act** — call tools, write to MongoDB, dispatch alerts
4. **Reflect** — compile summaries for doctor dashboard

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React.js, Tailwind CSS, React Router |
| **Backend** | Python 3.11+, FastAPI, Uvicorn |
| **AI Agent** | Google Gemma (multimodal), `google-adk`, `google-genai` |
| **Agent Tools** | MCP (Model Context Protocol) tools |
| **Storage** | MongoDB (via Motor async driver) |
| **Auth** | JWT (access + refresh tokens), bcrypt |
| **Maps** | Google Maps Platform (Places, Directions APIs) |
| **Notifications** | WebSockets + Push Notifications |
| **Hardware Ref** | ESP32 (physical reminder device — see `/hardware`) |

---

## 📁 Project Structure

```
smart-medication-reminder/
├── README.md
├── .env.example
├── backend/
│   ├── main.py                  # FastAPI entry point
│   ├── requirements.txt
│   ├── core/
│   │   ├── config.py            # Settings & env vars
│   │   ├── security.py          # JWT auth helpers
│   │   └── database.py          # MongoDB connection (Motor)
│   ├── agents/
│   │   ├── gemma_agent.py       # Gemma model + ADK agent loop
│   │   ├── tools/
│   │   │   ├── prescription_parser.py   # Image/text → structured Rx
│   │   │   ├── maps_tool.py             # Google Maps MCP tool
│   │   │   ├── web_search_tool.py       # Internet search MCP tool
│   │   │   └── alert_tool.py            # Send alerts to roles
│   │   └── prompts/
│   │       ├── patient_prompt.txt
│   │       ├── doctor_summary_prompt.txt
│   │       └── caregiver_alert_prompt.txt
│   ├── routers/
│   │   ├── auth.py              # /auth  — register, login, refresh
│   │   ├── patients.py          # /patients — CRUD + interactions
│   │   ├── prescriptions.py     # /prescriptions — upload, parse, manage
│   │   ├── reminders.py         # /reminders — schedule, snooze, history
│   │   ├── alerts.py            # /alerts — send, list, acknowledge
│   │   ├── caregivers.py        # /caregivers — link patient, dashboard
│   │   └── doctors.py           # /doctors — summaries, patient list
│   ├── models/
│   │   ├── user.py
│   │   ├── prescription.py
│   │   ├── reminder.py
│   │   └── alert.py
│   └── services/
│       ├── scheduler.py         # APScheduler — timed reminders
│       ├── notification.py      # Push + WebSocket dispatch
│       └── image_processor.py   # Pre-process camera images
├── frontend/
│   ├── package.json
│   ├── public/
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── pages/
│       │   ├── Auth/
│       │   │   ├── Login.jsx
│       │   │   └── Register.jsx
│       │   ├── Patient/
│       │   │   ├── Dashboard.jsx
│       │   │   ├── Chat.jsx           # AI interaction (text + image)
│       │   │   └── Reminders.jsx
│       │   ├── Caregiver/
│       │   │   ├── Dashboard.jsx
│       │   │   └── PatientView.jsx
│       │   └── Doctor/
│       │       ├── Dashboard.jsx
│       │       ├── PatientSummary.jsx
│       │       └── Prescriptions.jsx
│       ├── components/
│       │   ├── Navbar.jsx
│       │   ├── ReminderCard.jsx
│       │   ├── AlertBadge.jsx
│       │   ├── CameraCapture.jsx      # MediaDevices API
│       │   └── MapView.jsx            # Google Maps embed
│       ├── hooks/
│       │   ├── useAuth.js
│       │   └── useWebSocket.js
│       └── services/
│           └── api.js                 # Axios base client
└── hardware/                          # ESP32 physical device reference
    └── README.md                      # See ESP32 Code For My Med Reminder
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 18 |
| Python | ≥ 3.11 |
| MongoDB | ≥ 7.0 (local or Atlas) |
| Google Cloud account | (Maps API + Gemini/Gemma access) |

---

### Backend Setup

```bash
cd backend

# Create & activate virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Copy and fill in environment variables
cp ../.env.example .env

# Run the dev server
uvicorn main:app --reload --port 8000
```

The API will be live at `http://localhost:8000`.  
Interactive docs: `http://localhost:8000/docs`

---

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app will be live at `http://localhost:5173`.

---

## 🔑 Environment Variables

Create a `.env` file in the `backend/` directory (reference `.env.example`):

```dotenv
# ── App ──────────────────────────────────────────
APP_ENV=development
SECRET_KEY=your-secret-key-here

# ── MongoDB ───────────────────────────────────────
MONGODB_URI=mongodb://localhost:27017/smart_med_reminder

# ── Google AI ─────────────────────────────────────
GOOGLE_API_KEY=your-google-genai-api-key
GEMMA_MODEL_ID=gemma-3-27b-it          # or hosted endpoint

# ── Google Maps ───────────────────────────────────
GOOGLE_MAPS_API_KEY=your-maps-api-key

# ── JWT ───────────────────────────────────────────
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# ── Notifications ─────────────────────────────────
PUSH_NOTIFICATION_KEY=your-push-key
```

---

## 📡 API Overview

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Register (patient / caregiver / doctor) |
| `POST` | `/auth/login` | Login → JWT |
| `GET` | `/patients/me` | Get current patient profile |
| `POST` | `/prescriptions/upload` | Upload image or text prescription |
| `GET` | `/prescriptions/{id}` | Get parsed prescription details |
| `GET` | `/reminders` | List upcoming reminders |
| `POST` | `/reminders/{id}/snooze` | Snooze a reminder |
| `POST` | `/chat` | Send message/image to AI agent |
| `GET` | `/alerts` | List alerts for current user |
| `GET` | `/doctors/patients` | Doctor: list linked patients |
| `GET` | `/doctors/patients/{id}/summary` | AI-generated health summary |
| `GET` | `/maps/hospitals` | Nearby hospitals (lat/lng query) |

---

## 🤖 AI & Agentic System

The agent is built on **Google ADK** and uses **Gemma** as the base model, exposed through the `google-genai` SDK.

### MCP Tools registered to the agent

| Tool | Purpose |
|---|---|
| `parse_prescription` | Extracts drug name, dosage, frequency from image or text |
| `search_web` | Fetches up-to-date drug info, interactions, guidelines |
| `find_hospitals` | Queries Google Maps Places API for nearby hospitals |
| `send_alert` | Dispatches push/websocket alert to a target role |
| `write_summary` | Compiles and stores patient summary for doctor dashboard |

### Alert routing

```
Patient action / scheduled trigger
        │
        ▼
   Gemma Agent
   ├── → Patient/Caregiver:  "Time for your 8 AM Metformin dose"
   └── → Doctor:             "Patient John Doe reported chest pain (severity 7/10)"
```

---

## 🔩 Hardware Reference

This project was inspired by a physical **ESP32-based medication reminder device**.  
The hardware code lives in the companion folder:

> `ESP32 Code For My Med Reminder/`

The ESP32 handles:
- Local buzzer / LED alerts when no smartphone is present
- Button confirmation (dose taken)
- Wi-Fi sync with the backend API

See the hardware folder's own `README` for wiring diagrams and firmware flashing instructions.

---

## 🤝 Contributing

Contributions are welcome for Hacktoberfest! 🎃

1. Fork this repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to the branch: `git push origin feat/your-feature`
5. Open a Pull Request

Please read our `CONTRIBUTING.md` (coming soon) and follow the [Conventional Commits](https://www.conventionalcommits.org/) spec.

### Good first issues
- [ ] Add medication interaction checker tool
- [ ] Implement caregiver patient-linking flow
- [ ] Add dark mode to frontend
- [ ] Write unit tests for prescription parser
- [ ] Add multi-language support (i18n)

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Built with ❤️ for Hacktoberfest 🎃

**Smart Medication Reminder** — _Never miss a dose again._

</div>

