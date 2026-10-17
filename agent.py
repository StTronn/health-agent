"""Family health agent: one main agent, a three-specialist triage panel, one tool, one guardrail.
Behaviour lives in SOUL.md, prompt.md and skills/; memory lives in family/."""
from datetime import date, datetime
from pathlib import Path

from deepagents import create_deep_agent
from deepagents.backends import LocalShellBackend
from dotenv import load_dotenv
from langgraph.checkpoint.memory import MemorySaver

from guardrails import backstop, escalate

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")
WEB_SEARCH = {"type": "web_search"}  # OpenAI built-in search


def specialist(name: str, description: str) -> dict:
    """An isolated triage subagent: it sees the files and the reference, not the chat."""
    return {"name": name, "description": description, "system_prompt": (ROOT / f"subagents/{name}.md").read_text(),
            "skills": ["/skills/home-care/"], "tools": [WEB_SEARCH]}


agent = create_deep_agent(
    model="openai:gpt-6.1-sol",
    system_prompt="\n\n".join([(ROOT / "SOUL.md").read_text(), (ROOT / "prompt.md").read_text(), f"Today is {date.today()}."]),
    memory=["/family/MEMORY.md"],
    skills=["/skills/"],
    backend=LocalShellBackend(root_dir=ROOT, virtual_mode=True),
    tools=[escalate, WEB_SEARCH],  # extension point: lab, knowledge-base or telemedicine tools / MCP go here
    subagents=[specialist("assess", "How likely is home / doctor / emergency for this episode, and why."),
               specialist("challenge", "Argue both ways: what could be more urgent, what may be over-escalated."),
               specialist("ask", "The questions that would most change the level for this episode.")],
    middleware=[backstop],
    checkpointer=MemorySaver(),
)

if __name__ == "__main__":
    config = {"configurable": {"thread_id": datetime.now().isoformat()}}
    while (text := input("\nyou> ").strip()) not in ("", "exit"):
        result = agent.invoke({"messages": [{"role": "user", "content": text}]}, config)
        print("\nagent>", result["messages"][-1].text)
