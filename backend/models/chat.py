from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class NavigationActionModel(BaseModel):
    action: str = "navigate"
    target: str
    page_name: str
    reason: Optional[str] = None


class ChatMessageModel(BaseModel):
    id: str
    sender: str  # "user" | "agent"
    text: str
    image: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    hospitals: Optional[List[Dict[str, Any]]] = None
    navigation: Optional[NavigationActionModel] = None


class ChatSessionModel(BaseModel):
    id: str
    user_id: str
    title: str = "New Chat"
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    messages: List[ChatMessageModel] = []


class ChatSessionSummary(BaseModel):
    id: str
    user_id: str
    title: str
    timestamp: str
    updated_at: datetime
    message_count: int = 0
    last_message: Optional[str] = None

