import logging
from datetime import datetime
from typing import List, Optional, Dict, Any

logger = logging.getLogger(__name__)

# In-memory fallback when MongoDB is not connected
_MEM_CHAT_SESSIONS: Dict[str, Dict[str, Any]] = {}


def _db():
    """Lazy-load the database handle so module import never triggers a DB connection."""
    from backend.core.database import get_database
    return get_database()


def _normalize_session(doc: dict) -> dict:
    d = dict(doc)
    d.pop("_id", None)
    if "updated_at" in d and isinstance(d["updated_at"], datetime):
        d["updated_at"] = d["updated_at"].isoformat()
    return d


class ChatHistoryService:
    @staticmethod
    async def list_sessions(user_id: str) -> List[Dict[str, Any]]:
        """
        List all chat sessions for a specific user, sorted newest first.
        """
        database = _db()
        if database is not None:
            try:
                cursor = database.chat_sessions.find({"user_id": user_id}).sort("updated_at", -1)
                docs = await cursor.to_list(length=100)
                results = []
                for doc in docs:
                    norm = _normalize_session(doc)
                    messages = norm.get("messages", [])
                    results.append({
                        "id": norm["id"],
                        "user_id": norm.get("user_id", user_id),
                        "title": norm.get("title", "New Chat"),
                        "timestamp": norm.get("timestamp", datetime.utcnow().isoformat()),
                        "updated_at": norm.get("updated_at"),
                        "message_count": len(messages),
                        "last_message": messages[-1].get("text", "")[:100] if messages else "",
                        "messages": messages,
                    })
                return results
            except Exception as exc:
                logger.warning(f"Failed to query chat_sessions from MongoDB: {exc}")

        # In-memory fallback
        user_sessions = [
            s for s in _MEM_CHAT_SESSIONS.values()
            if s.get("user_id") == user_id
        ]
        user_sessions.sort(key=lambda s: s.get("updated_at", ""), reverse=True)
        return user_sessions

    @staticmethod
    async def get_session(session_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve full transcript and messages for a given session.
        """
        database = _db()
        if database is not None:
            try:
                doc = await database.chat_sessions.find_one({"id": session_id, "user_id": user_id})
                if not doc:
                    doc = await database.chat_sessions.find_one({"id": session_id})
                if doc:
                    return _normalize_session(doc)
            except Exception as exc:
                logger.warning(f"Error reading session {session_id} from MongoDB: {exc}")

        return _MEM_CHAT_SESSIONS.get(session_id)

    @staticmethod
    async def save_message(
        session_id: str,
        user_id: str,
        message: Dict[str, Any],
        title: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Append a chat message to the session transcript. Creates the session if it doesn't exist.
        """
        now = datetime.utcnow()
        now_iso = now.isoformat()
        database = _db()

        if database is not None:
            try:
                existing = await database.chat_sessions.find_one({"id": session_id})
                if not existing:
                    new_session = {
                        "id": session_id,
                        "user_id": user_id,
                        "title": title or "New Conversation",
                        "timestamp": now_iso,
                        "updated_at": now,
                        "messages": [message],
                    }
                    await database.chat_sessions.insert_one(new_session)
                    return _normalize_session(new_session)
                else:
                    update_fields: Dict[str, Any] = {"updated_at": now}
                    if title and existing.get("title") in ["New Chat", "New Conversation"]:
                        update_fields["title"] = title
                    await database.chat_sessions.update_one(
                        {"id": session_id},
                        {"$push": {"messages": message}, "$set": update_fields}
                    )
                    updated = await database.chat_sessions.find_one({"id": session_id})
                    return _normalize_session(updated)
            except Exception as exc:
                logger.warning(f"Error saving chat message to MongoDB: {exc}")

        # In-memory fallback
        if session_id not in _MEM_CHAT_SESSIONS:
            _MEM_CHAT_SESSIONS[session_id] = {
                "id": session_id,
                "user_id": user_id,
                "title": title or "New Conversation",
                "timestamp": now_iso,
                "updated_at": now_iso,
                "messages": [message],
            }
        else:
            sess = _MEM_CHAT_SESSIONS[session_id]
            sess["messages"].append(message)
            sess["updated_at"] = now_iso
            if title and sess.get("title") in ["New Chat", "New Conversation"]:
                sess["title"] = title

        return _MEM_CHAT_SESSIONS[session_id]

    @staticmethod
    async def delete_session(session_id: str, user_id: str) -> bool:
        """
        Delete a chat session transcript from the database.
        """
        database = _db()
        if database is not None:
            try:
                res = await database.chat_sessions.delete_one({"id": session_id, "user_id": user_id})
                if res.deleted_count > 0:
                    return True
                res = await database.chat_sessions.delete_one({"id": session_id})
                return res.deleted_count > 0
            except Exception as exc:
                logger.warning(f"Error deleting session {session_id} from MongoDB: {exc}")

        if session_id in _MEM_CHAT_SESSIONS:
            del _MEM_CHAT_SESSIONS[session_id]
            return True
        return False


chat_history_service = ChatHistoryService()
