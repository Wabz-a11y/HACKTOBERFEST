"""
MongoDB Atlas connection manager for Smart Medication Reminder API.

The application exclusively uses the Atlas cluster configured via MONGODB_URI
in .env. There is no localhost fallback — if Atlas is unreachable the app
logs a clear error and all DB-dependent routes return graceful HTTP 503
responses while the in-memory safety-net in each router keeps the API alive.
"""
import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from backend.core.config import settings

logger = logging.getLogger(__name__)


class Database:
    client: AsyncIOMotorClient = None
    db: AsyncIOMotorDatabase = None
    connected: bool = False


db = Database()


async def connect_to_mongo():
    uri = settings.MONGODB_URI
    db_name = settings.DB_NAME

    # Reject the bare localhost URI that would slip through if .env failed to load
    if "localhost" in uri or "127.0.0.1" in uri:
        logger.error(
            "MONGODB_URI points to localhost — refusing to connect. "
            "Ensure the Atlas URI from .env is loaded correctly. "
            "Running in in-memory fallback mode."
        )
        return

    try:
        db.client = AsyncIOMotorClient(
            uri,
            serverSelectionTimeoutMS=8000,
            connectTimeoutMS=8000,
            socketTimeoutMS=15000,
            retryWrites=True,
            w="majority",
        )
        db.db = db.client[db_name]

        # Ping to confirm Atlas is reachable
        await db.client.admin.command("ping")
        db.connected = True
        logger.info(f"✅ Connected to MongoDB Atlas — database '{db_name}'")

        # Background indexes for fast queries
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
        logger.info("📇 MongoDB Atlas indexes verified.")

    except Exception as exc:
        db.connected = False
        logger.error(
            f"❌ MongoDB Atlas connection failed: {exc}\n"
            "   → Check your MONGODB_URI in .env and ensure your IP is whitelisted "
            "in the Atlas Network Access panel.\n"
            "   → Running in in-memory fallback mode — data will NOT persist across restarts."
        )


async def close_mongo_connection():
    if db.client:
        db.client.close()
        logger.info("MongoDB Atlas connection closed.")


def get_database() -> AsyncIOMotorDatabase | None:
    """
    Returns the live Atlas DB handle.
    Returns None only when the Atlas connection failed — callers must handle
    this by falling back to their in-memory store.
    """
    return db.db if db.connected else None


def is_db_connected() -> bool:
    return db.connected
