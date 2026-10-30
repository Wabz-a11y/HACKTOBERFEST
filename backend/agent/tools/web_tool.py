import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


def search_web(query: str) -> Dict[str, Any]:
    """
    Retrieves pharmacological guidelines, food/drug interactions, and missed dose procedures.
    """
    q_low = (query or "").lower()
    
    # Pre-indexed clinical knowledge for instant deterministic verification
    knowledge_base = {
        "missed dose": (
            "Standard Clinical Guidance for Missed Doses: If you remember within 2-4 hours of your scheduled time, "
            "take the dose immediately unless it is almost time for your next regular dose. Never take a double dose "
            "to make up for a missed one, as this can trigger acute toxicity or hypotensive/hypoglycemic episodes."
        ),
        "grapefruit": (
            "Grapefruit Interaction Alert: Grapefruit contains furanocoumarins which inhibit the CYP3A4 enzyme in the intestines. "
            "This severely impairs the breakdown of certain medications (such as Atorvastatin, Simvastatin, and calcium channel blockers), "
            "leading to dangerously elevated drug levels in the bloodstream."
        ),
        "food": (
            "Food & Medication Instructions: Taking drugs with food buffers gastric mucosa (reducing nausea from NSAIDs like Ibuprofen "
            "and Metformin), while other drugs (like Omeprazole and Levothyroxine) require an empty stomach with water 30-60 minutes "
            "before breakfast for optimal systemic absorption."
        ),
        "alcohol": (
            "Alcohol & Medication Warning: Alcohol should be strictly avoided with antibiotics (Metronidazole, Cephalosporins), "
            "sedatives, and Paracetamol (increases hepatotoxicity risk). Alcohol also compounds drowsiness and can cause severe flushing and nausea."
        ),
        "side effects": (
            "Common vs. Red Flag Side Effects: Mild nausea, mild dry mouth, or slight dizziness are common initial reactions. "
            "However, severe rash, facial swelling, difficulty breathing, chest pain, or jaundice are medical emergencies requiring immediate ER care."
        )
    }

    matched_insights = []
    for key, text in knowledge_base.items():
        if key in q_low:
            matched_insights.append(text)

    if not matched_insights:
        matched_insights.append(
            f"Pharmacological Guidance for '{query}': Always adhere strictly to prescribed dosages. Take with clean water, store at room temperature away from moisture, and contact your prescribing clinician if adverse reactions occur."
        )

    return {
        "status": "success",
        "query": query,
        "results": "\n\n".join(matched_insights)
    }

