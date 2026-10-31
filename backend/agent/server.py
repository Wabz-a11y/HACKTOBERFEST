import logging
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

from backend.agent.agent import ask_med_agent
from backend.services.chat_history import chat_history_service
from backend.core.security import decode_access_token
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["Agent"])
bearer_scheme = HTTPBearer(auto_error=False)


def get_optional_user_id(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)) -> str:
    """Extracts user ID from Bearer token if present, else defaults to 'guest_user'."""
    if credentials and credentials.credentials:
        payload = decode_access_token(credentials.credentials)
        if payload and "sub" in payload:
            return payload["sub"]
    return "default_patient"


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    image_data: Optional[str] = None  # Base64 camera photo or file
    patient_info: Optional[Dict[str, Any]] = None


class NavigationActionResponse(BaseModel):
    action: str = "navigate"
    target: str
    page_name: str
    reason: Optional[str] = None


class ChatResponse(BaseModel):
    output: str
    session_id: str
    is_emergency: bool = False
    hospitals: Optional[List[Dict[str, Any]]] = None
    navigation: Optional[NavigationActionResponse] = None


@router.get("/sessions")
async def list_chat_sessions(user_id: str = Depends(get_optional_user_id)):
    """
    List all chat sessions / transcripts for the user stored in the database.
    """
    sessions = await chat_history_service.list_sessions(user_id)
    return sessions


@router.get("/sessions/{session_id}")
async def get_chat_session(session_id: str, user_id: str = Depends(get_optional_user_id)):
    """
    Retrieve full transcript of a specific chat session.
    """
    session = await chat_history_service.get_session(session_id, user_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    return session


@router.delete("/sessions/{session_id}")
async def delete_chat_session(session_id: str, user_id: str = Depends(get_optional_user_id)):
    """
    Delete a chat session transcript from the database.
    """
    success = await chat_history_service.delete_session(session_id, user_id)
    return {"status": "success", "deleted": success}


@router.post("", response_model=ChatResponse)
async def chat_with_agent(
    req: ChatRequest,
    user_id: str = Depends(get_optional_user_id),
):
    """
    Core chat inference endpoint.
    Retrieves previous conversation context from the database, executes clinical tools,
    persists the conversation transcript in MongoDB, and supports page navigation.
    """
    if not req.message and not req.image_data:
        raise HTTPException(status_code=400, detail="Please provide a message or prescription image.")

    session_id = req.session_id or f"session_{uuid.uuid4().hex[:8]}"

    # 1. Fetch existing session to provide context for continuing the interaction
    existing_session = await chat_history_service.get_session(session_id, user_id)
    prior_messages = existing_session.get("messages", []) if existing_session else []

    # 2. Derive a human-friendly title if this is the start of a new thread
    first_text = (req.message or "").strip()
    session_title = (
        (first_text[:35] + "…") if len(first_text) > 35 else (first_text or "Medication Inquiry")
    )

    # 3. Save User message to the database transcript
    user_msg_doc = {
        "id": f"msg_user_{uuid.uuid4().hex[:8]}",
        "sender": "user",
        "text": req.message,
        "image": req.image_data,
        "timestamp": datetime.utcnow().isoformat(),
    }
    await chat_history_service.save_message(
        session_id=session_id,
        user_id=user_id,
        message=user_msg_doc,
        title=session_title if not existing_session else None
    )

    # 4. Invoke MedAgent with prior transcript history
    res = await ask_med_agent(
        session_id=session_id,
        user_text=req.message,
        patient_info=req.patient_info,
        image_data=req.image_data,
        user_id=user_id,
        conversation_history=prior_messages
    )

    output_text = res.get("output", "") if isinstance(res, dict) else str(res)
    is_emergency = res.get("is_emergency", False) if isinstance(res, dict) else False
    hospitals = res.get("hospitals", None) if isinstance(res, dict) else None
    navigation = res.get("navigation", None) if isinstance(res, dict) else None

    # 5. Save Agent response to the database transcript
    agent_msg_doc = {
        "id": f"msg_agent_{uuid.uuid4().hex[:8]}",
        "sender": "agent",
        "text": output_text,
        "timestamp": datetime.utcnow().isoformat(),
        "hospitals": hospitals,
        "navigation": navigation,
    }
    await chat_history_service.save_message(
        session_id=session_id,
        user_id=user_id,
        message=agent_msg_doc
    )

    return ChatResponse(
        output=output_text,
        session_id=session_id,
        is_emergency=is_emergency,
        hospitals=hospitals,
        navigation=navigation
    )
