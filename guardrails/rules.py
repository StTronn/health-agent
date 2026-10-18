"""Deterministic check: phrases that always mean emergency. Kept short on purpose;
the full clinical list lives in skills/home-care/red-flags.md for the agent."""
import re

RED_FLAGS = re.compile(r"\b(" + "|".join([
    r"not breathing", r"stopped breathing", r"can'?t breathe", r"gasping",
    r"unconscious", r"unresponsive", r"(won'?t|can'?t|cannot) (wake|be woken)",
    r"chest pain", r"seizure", r"convulsing", r"blue lips", r"turning blue",
    r"face (is )?drooping", r"slurred speech", r"severe bleeding", r"won'?t stop bleeding",
    r"overdose", r"swallowed (pills|poison|bleach)", r"suicid\w*", r"kill (myself|himself|herself)",
]) + r")\b", re.I)
# A red flag doesn't count when its own clause negates it ("no seizure", "denied fever or chest pain").
NEGATION = re.compile(r"\b(no|not|never|without|denie[sd]|negative for|hasn'?t had|didn'?t have|has not had|did not have)\b", re.I)


def check(message: str, conversation: str) -> bool:
    return any(not NEGATION.search(re.split(r"[.!?;\n]|\bbut\b", message[:m.start()])[-1])
               for m in RED_FLAGS.finditer(message))
