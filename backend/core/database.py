import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from backend.core.config import settings

logger = logging.getLogger(__name__)


class Database:
    client: AsyncIOMotorClient = None
    db: AsyncIOMotorDatabase = None


db = Database()


async def connect_to_mongo():
    try:
        db.client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=2500)
        db.db = db.client[settings.DB_NAME]
        # Quick ping to verify or fail gracefully
        await db.client.admin.command('ping')
        logger.info(f"Connected to MongoDB database '{settings.DB_NAME}'")
    except Exception as exc:
        logger.warning(f"MongoDB connection ping failed: {exc}. Running in memory fallback mode if needed.")


async def close_mongo_connection():
    if db.client:
        db.client.close()
        logger.info("MongoDB connection closed.")


def get_database() -> AsyncIOMotorDatabase:
    return db.db

