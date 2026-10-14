"""Model-based check: one Jev judgment over the recent conversation.
Skipped when TYPESAFE_API_KEY is unset."""
import os

from typesafe_sdk import Noul, TypeSafeClient

THRESHOLD = 0.8
QUESTION = Noul(instructions=(
    "Based on `conversation`, does the person whose symptoms are being described need "
    "emergency services right now (for example trouble breathing, chest pain, stroke signs, "
    "unresponsiveness, severe bleeding, a seizure, or a very sick infant)?"
))


def check(message: str, conversation: str) -> bool:
    if not os.getenv("TYPESAFE_API_KEY"):
        return False
    with TypeSafeClient() as client:
        response = client.system_one(state={"conversation": conversation}, questions={"emergency": QUESTION})
    return response.nouls["emergency"].noul >= THRESHOLD
