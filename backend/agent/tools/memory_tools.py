from typing import Dict, Any, Optional
from backend.agent.memory.memory_manager import memory_manager


def recall_memory(query: str) -> Dict[str, Any]:
    """
    Semantically searches the patient's past interaction and adherence memory archive.
    """
    result = memory_manager.search_memory(query)
    return {
        "status": "success",
        "query": query,
        "memories": result
    }


def remember_patient(patient_id: str, key: str, value: str) -> Dict[str, Any]:
    """
    Saves a persistent patient health preference, allergy, or habit to long-term memory.
    """
    long_mem = memory_manager.load_long_term()
    patients = long_mem.setdefault("patients", {})
    p_data = patients.setdefault(patient_id, {})
    p_data[key] = value
    memory_manager.save_long_term(long_mem)
    return {
        "status": "success",
        "message": f"Saved {key}='{value}' for patient {patient_id} in persistent memory."
    }

