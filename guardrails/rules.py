"""Deterministic check: phrases that always mean emergency. Kept short on purpose;
the full clinical list lives in skills/triage/red-flags.md for the agent."""
import re

NOT = r"(?<!\bno )(?<!\bnot )(?<!\bwithout )(?<!\bnever )"
RED_FLAGS = re.compile(NOT + r"\b(" + "|".join([
    r"not breathing", r"stopped breathing", r"can'?t breathe", r"gasping",
    r"unconscious", r"unresponsive", r"(won'?t|can'?t|cannot) (wake|be woken)",
    r"chest pain", r"seizure", r"convulsing", r"blue lips", r"turning blue",
    r"face (is )?drooping", r"slurred speech", r"severe bleeding", r"won'?t stop bleeding",
    r"overdose", r"swallowed (pills|poison|bleach)", r"suicid\w*", r"kill (myself|himself|herself)",
]) + r")\b", re.I)


def check(message: str, conversation: str) -> bool:
    return bool(RED_FLAGS.search(message))
