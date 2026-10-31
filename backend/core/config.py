import os
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_NAME: str = "Smart Medication Reminder API"
    APP_ENV: str = "development"
    PORT: int = 8000
    
    # MongoDB — must be set to a valid Atlas URI in .env; localhost is rejected at startup
    MONGODB_URI: str = ""   # Set via MONGODB_URI in .env
    DB_NAME: str = "smart_med_reminder"
    
    # Google AI / Gemma / Gemini
    GOOGLE_API_KEY: str = ""
    GEMMA_MODEL_ID: str = "gemini-2.5-flash"
    
    # TalkSasa SMS Gateway
    TALKSASA_API_KEY: str = ""
    TALKSASA_SENDER_ID: str = "TALKSASA"
    TALKSASA_API_URL: str = "https://bulksms.talksasa.com/api/v3/sms/send"
    SUPPORT_PHONE: str = ""
    
    # JWT Authentication
    JWT_SECRET_KEY: str = "smart-medication-reminder-jwt-secret-key-2026-hacktoberfest"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day for hackathon convenience
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
        env_file = ".env"
        extra = "allow"


settings = Settings()
