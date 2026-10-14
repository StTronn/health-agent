"""Family health agent: one main agent, one triage fork, one tool, one guardrail.
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

agent = create_deep_agent(
    model="openai:gpt-6.1-sol",
    system_prompt="\n\n".join([(ROOT / "SOUL.md").read_text(), (ROOT / "prompt.md").read_text(), f"Today is {date.today()}."]),
    memory=["/family/MEMORY.md"],
    skills=["/skills/"],
    backend=LocalShellBackend(root_dir=ROOT, virtual_mode=True),
    tools=[escalate],  # extension point: lab, knowledge-base or telemedicine tools / MCP go here
    subagents=[{
        "name": "triage", "mode": "fork", "tools": [],
        "description": "Continue this conversation as the triage clinician: follow the triage skill on the "
                       "current episode and return either focused questions or a level with evidence.",
    }],
    middleware=[backstop],
    checkpointer=MemorySaver(),
)

if __name__ == "__main__":
    config = {"configurable": {"thread_id": datetime.now().isoformat()}}
    while (text := input("\nyou> ").strip()) not in ("", "exit"):
        result = agent.invoke({"messages": [{"role": "user", "content": text}]}, config)
        print("\nagent>", result["messages"][-1].text)
