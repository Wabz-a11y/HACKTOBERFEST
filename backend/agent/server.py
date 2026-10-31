from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from backend.agent.agent import ask_med_agent

router = APIRouter(prefix="/chat", tags=["Agent"])


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = "default_session"
    image_data: Optional[str] = None  # Base64 camera photo or file
    patient_info: Optional[Dict[str, Any]] = None


class ChatResponse(BaseModel):
    output: str
    session_id: str
    is_emergency: bool = False
    hospitals: Optional[List[Dict[str, Any]]] = None


@router.post("", response_model=ChatResponse)
async def chat_with_agent(req: ChatRequest):
    if not req.message and not req.image_data:
        raise HTTPException(status_code=400, detail="Please provide a message or prescription image.")
    
    res = await ask_med_agent(
        session_id=req.session_id or "default_session",
        user_text=req.message,
        patient_info=req.patient_info,
        image_data=req.image_data
    )

    if isinstance(res, dict):
        return ChatResponse(
            output=res.get("output", ""),
            session_id=req.session_id or "default_session",
            is_emergency=res.get("is_emergency", False),
            hospitals=res.get("hospitals", None)
        )

    return ChatResponse(
        output=str(res),
        session_id=req.session_id or "default_session",
        is_emergency=False,
        hospitals=None
    )
