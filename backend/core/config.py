import os
from pathlib import Path
from typing import List
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Robustly locate backend/.env regardless of current working directory
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ROOT_DIR = _BACKEND_DIR.parent

# Load environment files in priority order
for env_path in [
    _BACKEND_DIR / ".env",
    _ROOT_DIR / ".env",
    Path(".env"),
    Path("backend/.env"),
]:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path, override=False)


class Settings(BaseSettings):
    APP_NAME: str = "Smart Medication Reminder API"
    APP_ENV: str = "development"
    PORT: int = 8000
    
    # MongoDB Atlas (configured in .env)
    MONGODB_URI: str = os.getenv("MONGODB_URI", "")
    DB_NAME: str = os.getenv("DB_NAME", "medication")
    
    # Google AI / Gemma / Gemini
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
    GEMMA_MODEL_ID: str = os.getenv("GEMMA_MODEL_ID", "gemini-2.5-flash")
    
    # TalkSasa SMS Gateway
    TALKSASA_API_KEY: str = os.getenv("TALKSASA_API_KEY", "")
    TALKSASA_SENDER_ID: str = os.getenv("TALKSASA_SENDER_ID", "TALKSASA")
    TALKSASA_API_URL: str = os.getenv("TALKSASA_API_URL", "https://bulksms.talksasa.com/api/v3/sms/send")
    SUPPORT_PHONE: str = os.getenv("SUPPORT_PHONE", "")
    
    # JWT Authentication
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "smart-medication-reminder-jwt-secret-key-2026-hacktoberfest")
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:8000",
        "*",
    ]

    class Config:
        env_file = [
            str(_BACKEND_DIR / ".env"),
            str(_ROOT_DIR / ".env"),
            ".env",
            "backend/.env",
        ]
        extra = "allow"


settings = Settings()
