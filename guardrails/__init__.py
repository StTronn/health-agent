"""Everything deterministic: the fixed escalation messages, the escalate tool that
routes a case, and the backstop that has the last word on every turn."""
import re
from datetime import datetime
from pathlib import Path
from typing import Literal

from langchain.agents.middleware import after_agent
from langchain_core.messages import AIMessage
from langchain_core.tools import tool

from . import jev, rules

FAMILY = Path(__file__).parent.parent / "family"
MESSAGES = {
    "emergency": "This may be a medical emergency. Call your local emergency number now ({number}) "
                 "or go to the nearest emergency department. Don't wait for a reply here.",
    "doctor": "I'm transferring this case to a human doctor. They will review everything you've shared "
              "and get back to you shortly. If things get worse before then, call your local emergency number.",
}
CHECKS = [rules.check, jev.check]  # (latest user message, recent conversation) -> bool


def message(level: str) -> str:
    number = re.search(r"emergency:\s*(\S+)", (FAMILY / "MEMORY.md").read_text())
    return MESSAGES[level].format(number=number[1] if number else "e.g. 112 / 911")


def handoff(level: str, episode: str, reason: str) -> str:
    with open(FAMILY / "handoffs.md", "a") as f:
        f.write(f"- {datetime.now():%Y-%m-%d %H:%M} · {level} · [[episodes/{episode}]] · {reason}\n")
    return message(level)


@tool(return_direct=True)
def escalate(level: Literal["emergency", "doctor"], episode: str, reason: str) -> str:
    """Hand the case to emergency services or a human doctor. The user receives a fixed
    message, so call this alone, as your final action, after the episode file is updated."""
    return handoff(level, episode, reason)


@after_agent
def backstop(state, runtime):
    """An escalation always ends on its fixed message; a missed red flag becomes one."""
    if state.get("_deepagents_forked_context"):  # the triage fork never speaks to the user
        return None
    msgs = state["messages"]
    turn = msgs[max(i for i, m in enumerate(msgs) if m.type == "human"):]
    escalation = next((m for m in turn if m.type == "tool" and m.name == "escalate"), None)
    conversation = "\n".join(f"{m.type}: {m.text}" for m in msgs[-12:] if m.type in ("human", "ai") and m.text)
    if escalation:
        fixed = escalation.text
    elif any(check(turn[0].text, conversation) for check in CHECKS):
        fixed = handoff("emergency", "unknown", f"backstop: {turn[0].text[:80]}")
    else:
        return None
    return None if msgs[-1].text == fixed else {"messages": [AIMessage(fixed)]}
