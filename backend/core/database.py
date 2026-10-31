"""
MongoDB Atlas connection manager for Smart Medication Reminder API.

The application uses MongoDB Atlas configured via MONGODB_URI.
Supports SSL/TLS with certifi root CA certificates and creates collection
indexes on startup.
"""
import os
import logging
import certifi
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from backend.core.config import settings

logger = logging.getLogger(__name__)


class Database:
    client: AsyncIOMotorClient = None
    db: AsyncIOMotorDatabase = None
    connected: bool = False


db = Database()


async def connect_to_mongo():
    uri = (settings.MONGODB_URI or os.getenv("MONGODB_URI", "")).strip()
    db_name = (settings.DB_NAME or os.getenv("DB_NAME", "medication")).strip()

    if not uri:
        logger.error(
            "❌ MONGODB_URI is empty. Please ensure MONGODB_URI is defined in .env.\n"
            "   → Running in in-memory fallback mode."
        )
        return

    # Reject unintentional localhost fallbacks
    if "localhost" in uri or "127.0.0.1" in uri:
        logger.error(
            "❌ MONGODB_URI points to localhost — refusing to connect. "
            "Please configure the MongoDB Atlas cluster URI.\n"
            "   → Running in in-memory fallback mode."
        )
        return

    try:
        # Connect to MongoDB Atlas with certifi CA bundle
        db.client = AsyncIOMotorClient(
            uri,
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=8000,
            connectTimeoutMS=8000,
            socketTimeoutMS=15000,
            retryWrites=True,
            w="majority",
        )
        db.db = db.client[db_name]

        # Verify connectivity with an admin ping
        await db.client.admin.command("ping")
        db.connected = True
        logger.info(f"✅ Connected to MongoDB Atlas — database '{db_name}'")

        # Create indexes for optimal query performance
        await db.db.users.create_index("email", unique=True, background=True)
        await db.db.users.create_index("id", unique=True, background=True)
        await db.db.reminders.create_index(
            [("patient_id", 1), ("scheduled_time", 1)], background=True
        )
        await db.db.reminders.create_index("id", unique=True, background=True)
        await db.db.prescriptions.create_index("patient_id", background=True)
        await db.db.prescriptions.create_index("id", unique=True, background=True)
        await db.db.alerts.create_index(
            [("recipient_id", 1), ("recipient_role", 1)], background=True
        )
        await db.db.alerts.create_index("id", unique=True, background=True)
        await db.db.chat_sessions.create_index(
            [("user_id", 1), ("updated_at", -1)], background=True
        )
        await db.db.chat_sessions.create_index("id", unique=True, background=True)
        logger.info("📇 MongoDB Atlas collections & indexes verified.")

    except Exception as exc:
        db.connected = False
        logger.error(
            f"❌ MongoDB Atlas connection failed: {exc}\n"
            "   → Running in in-memory fallback mode — data will NOT persist across restarts."
        )


async def close_mongo_connection():
    if db.client:
        db.client.close()
        db.connected = False
        logger.info("MongoDB Atlas connection closed.")


def get_database() -> AsyncIOMotorDatabase | None:
    """
    Returns the live Atlas database handle.
    Returns None if connection is inactive, triggering route-level memory safety net.
    """
    return db.db if db.connected else None


def is_db_connected() -> bool:
    return db.connected
