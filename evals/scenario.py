"""One session of a simulated parent talking to the agent. Harbor runs this as the
LangGraph graph `scenario`, once per step; the step's instruction is the parent's
brief. The agent and its family/ live in the workspace (/app), so memory carries
over between steps, and each session is appended to transcript.md for the judge."""
import shutil
import sys
from pathlib import Path

from langchain.chat_models import init_chat_model
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

REPO = Path(__file__).parent.parent
WS = Path("/app") if Path("/app").is_dir() else REPO / "evals/out"
if not (WS / "agent.py").exists():  # first step: the workspace gets its own copy of the agent
    shutil.copytree(REPO, WS, dirs_exist_ok=True, ignore=shutil.ignore_patterns(".*", "evals", "__pycache__"))
sys.path.insert(0, str(WS))
from agent import agent  # noqa: E402

PARENT = """You are role-playing the person described in the brief below, messaging a health assistant.
Write only your next message: short and natural, answering only what you're asked from the facts given. Never volunteer facts you weren't asked about, and if the assistant escalates, accept it and end.
When the brief says the conversation is over, reply exactly [END].

{brief}"""


def steps(messages) -> str:
    calls = [c for m in messages if m.type == "ai" for c in m.tool_calls]
    arg = lambda a: a.get("file_path") or a.get("subagent_type") or a.get("level") or a.get("path") or ""
    return " · ".join(f"{c['name']}({arg(c['args'])})" for c in calls) or "none"


class Scenario:
    async def ainvoke(self, input, config=None, max_turns=12):
        transcript = WS / "transcript.md"
        session = (transcript.read_text().count("## Session ") if transcript.exists() else 0) + 1
        parent = init_chat_model("openai:gpt-6.1-sol")
        history = [SystemMessage(PARENT.format(brief=input["messages"][0]["content"])), HumanMessage("(the conversation starts)")]
        config, lines = {"configurable": {"thread_id": f"session-{session}"}}, [f"## Session {session}"]
        for _ in range(max_turns):
            said = (await parent.ainvoke(history)).text.strip()
            if "[END]" in said:
                break
            history.append(AIMessage(said))
            before = len((await agent.aget_state(config)).values.get("messages", []))
            new = (await agent.ainvoke({"messages": [{"role": "user", "content": said}]}, config))["messages"][before:]
            lines += ["", f"**Parent:** {said}", "", f"> steps: {steps(new)}", "", f"**Agent:** {new[-1].text}"]
            history.append(HumanMessage(new[-1].text))
        with open(transcript, "a") as f:
            f.write("\n".join(lines) + "\n\n")
        return {"messages": [AIMessage("\n".join(lines))]}


scenario = Scenario()
