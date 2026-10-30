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


@router.post("", response_model=ChatResponse)
async def chat_with_agent(req: ChatRequest):
    if not req.message and not req.image_data:
        raise HTTPException(status_code=400, detail="Please provide a message or prescription image.")
    
    reply = await ask_med_agent(
        session_id=req.session_id,
        user_text=req.message,
        patient_info=req.patient_info,
        image_data=req.image_data
    )
    return ChatResponse(output=reply, session_id=req.session_id)

