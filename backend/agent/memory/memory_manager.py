import json
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

_MEMORY_DIR = Path(__file__).parent
_SHORT_TERM_FILE = _MEMORY_DIR / "short_term.json"
_LONG_TERM_FILE = _MEMORY_DIR / "long_term.json"

SHORT_TERM_MAX = 15
LONG_TERM_MAX = 300

_DEFAULT_SHORT_TERM: Dict[str, Any] = {
    "session_id": "default_patient_session",
    "turn_count": 0,
    "active_patient_id": None,
    "active_drug_topic": None,
    "last_symptom_reported": None,
    "last_tool_executed": None,
    "recent_interactions": [],
}

_DEFAULT_LONG_TERM: Dict[str, Any] = {
    "patients": {},
    "chronic_conditions": {},
    "allergies": {},
    "adherence_history": [],
    "historical_summaries": [],
}


class MemoryManager:
    def __init__(self):
        self._lock = threading.Lock()
        self._ensure_files()

    def _ensure_files(self) -> None:
        _MEMORY_DIR.mkdir(parents=True, exist_ok=True)
        if not _SHORT_TERM_FILE.exists():
            self.save_short_term(_DEFAULT_SHORT_TERM)
        if not _LONG_TERM_FILE.exists():
            self.save_long_term(_DEFAULT_LONG_TERM)

    def load_short_term(self) -> Dict[str, Any]:
        with self._lock:
            try:
                if _SHORT_TERM_FILE.exists():
                    with open(_SHORT_TERM_FILE, "r", encoding="utf-8") as fh:
                        return {**_DEFAULT_SHORT_TERM, **json.load(fh)}
            except Exception:
                pass
            return dict(_DEFAULT_SHORT_TERM)

    def save_short_term(self, data: Dict[str, Any]) -> None:
        with self._lock:
            try:
                with open(_SHORT_TERM_FILE, "w", encoding="utf-8") as fh:
                    json.dump(data, fh, indent=2, ensure_ascii=False)
            except Exception:
                pass

    def load_long_term(self) -> Dict[str, Any]:
        with self._lock:
            try:
                if _LONG_TERM_FILE.exists():
                    with open(_LONG_TERM_FILE, "r", encoding="utf-8") as fh:
                        return {**_DEFAULT_LONG_TERM, **json.load(fh)}
            except Exception:
                pass
            return dict(_DEFAULT_LONG_TERM)

    def save_long_term(self, data: Dict[str, Any]) -> None:
        with self._lock:
            try:
                with open(_LONG_TERM_FILE, "w", encoding="utf-8") as fh:
                    json.dump(data, fh, indent=2, ensure_ascii=False)
            except Exception:
                pass

    def record_turn(self, user_msg: str, agent_msg: str, patient_id: Optional[str] = None, tool: Optional[str] = None):
        short = self.load_short_term()
        turn = short.get("turn_count", 0) + 1
        short["turn_count"] = turn
        if patient_id:
            short["active_patient_id"] = patient_id
        if tool:
            short["last_tool_executed"] = tool

        entry = {
            "turn": turn,
            "timestamp": datetime.now().isoformat(),
            "user": user_msg,
            "agent": agent_msg,
            "tool": tool,
        }
        interactions = short.get("recent_interactions", [])
        interactions.append(entry)

        # Evict oldest turn and archive to long-term memory
        evicted = None
        if len(interactions) > SHORT_TERM_MAX:
            evicted = interactions.pop(0)

        short["recent_interactions"] = interactions
        self.save_short_term(short)

        if evicted:
            threading.Thread(target=self._archive_turn, args=(evicted,), daemon=True).start()

    def _archive_turn(self, item: Dict[str, Any]):
        try:
            long_mem = self.load_long_term()
            archive = long_mem.setdefault("historical_summaries", [])
            summary = f"Patient asked: {item.get('user')[:200]} | Agent replied: {item.get('agent')[:250]}"
            archive.append({
                "ts": item.get("timestamp"),
                "summary": summary,
            })
            if len(archive) > LONG_TERM_MAX:
                long_mem["historical_summaries"] = archive[-LONG_TERM_MAX:]
            self.save_long_term(long_mem)
        except Exception:
            pass

    def search_memory(self, query: str) -> str:
        q = (query or "").lower().strip()
        if not q:
            return "No query provided."
        long_mem = self.load_long_term()
        hits = []
        for item in long_mem.get("historical_summaries", []):
            summ = item.get("summary", "")
            if q in summ.lower():
                hits.append(f"[{item.get('ts', '')[:10]}] {summ}")
        if hits:
            return "\n".join(hits[-5:])
        return f"No prior clinical records found matching '{query}'."

    def build_runtime_context(self, patient_info: Optional[Dict[str, Any]] = None) -> str:
        now = datetime.now()
        short = self.load_short_term()
        interactions = short.get("recent_interactions", [])[-6:]
        
        lines = [
            "==================================================",
            "  MEDAGENT CLINICAL RUNTIME CONTEXT",
            "==================================================",
            f"* Current Date & Time: {now.strftime('%A, %B %d, %Y - %I:%M %p')}",
        ]
        if patient_info:
            lines.append(f"* Active Patient: {patient_info.get('full_name')} (ID: {patient_info.get('id')})")
            if patient_info.get('allergies'):
                lines.append(f"* Known Allergies: {patient_info.get('allergies')}")
            if patient_info.get('chronic_conditions'):
                lines.append(f"* Chronic Conditions: {patient_info.get('chronic_conditions')}")

        if interactions:
            lines.append("\n[RECENT INTERACTION TURNS]")
            for t in interactions:
                lines.append(f"- User: \"{t.get('user', '')}\" -> Agent: \"{t.get('agent', '')}\"")

        return "\n".join(lines)


memory_manager = MemoryManager()

