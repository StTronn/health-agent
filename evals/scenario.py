"""One session of a simulated parent talking to the deployed agent over HTTP. Harbor runs
this as the LangGraph graph `scenario`, once per step; the step's instruction is the
parent's brief. The first step seeds a fresh household from the repo's family/ folder;
its memory lives in the agent and carries over between steps. After each session the
household's files are copied to the workspace (/app/family) and the session is appended
to transcript.md, for the judge."""
import os
import shutil
import uuid
from pathlib import Path

import httpx
from langchain.chat_models import init_chat_model
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

REPO = Path(__file__).parent.parent
WS = Path("/app") if Path("/app").is_dir() else REPO / "evals/out"

PARENT = """You are role-playing a parent texting a family health assistant, following the brief below.
Write only your next message: short and natural, answering only what you're asked from the facts given. Never volunteer facts you weren't asked about, and if the assistant escalates, accept it and end.
When the brief says the conversation is over, reply exactly [END].

{brief}"""


class Scenario:
    async def ainvoke(self, input, config=None, max_turns=12):
        WS.mkdir(parents=True, exist_ok=True)
        hid_file, transcript = WS / ".household", WS / "transcript.md"
        session = (transcript.read_text().count("## Session ") if transcript.exists() else 0) + 1
        async with httpx.AsyncClient(base_url=os.environ["AGENT_URL"], timeout=600,
                                     headers={"Authorization": f"Bearer {os.environ['AGENT_TOKEN']}"}) as http:
            seed = not hid_file.exists()
            if seed:
                hid_file.write_text(str(uuid.uuid4()))
            api = f"/api/households/{hid_file.read_text().strip()}"
            if seed:  # first step: a fresh household seeded from the repo's family/
                files = {p.relative_to(REPO).as_posix(): p.read_text() for p in (REPO / "family").rglob("*")
                         if p.is_file() and ".browser" not in p.parts}
                (await http.put(f"{api}/files", json={"files": files, "reset": True})).raise_for_status()
            parent = init_chat_model("openai:gpt-6.1-sol")
            history = [SystemMessage(PARENT.format(brief=input["messages"][0]["content"])), HumanMessage("(the conversation starts)")]
            conversation, lines = "new", [f"## Session {session}"]
            for _ in range(max_turns):
                said = (await parent.ainvoke(history)).text.strip()
                if "[END]" in said:
                    break
                history.append(AIMessage(said))
                r = (await http.post(f"{api}/messages", json={"text": said, "conversation": conversation})).raise_for_status().json()
                conversation = r["conversation"]
                steps = " · ".join(f"{s['name']}({s.get('arg') or ''})" for s in r.get("steps", [])) or "none"
                lines += ["", f"**Parent:** {said}", "", f"> steps: {steps}", "", f"**Agent:** {r['reply']}"]
                history.append(HumanMessage(r["reply"]))
            shutil.rmtree(WS / "family", ignore_errors=True)
            for path, text in (await http.get(f"{api}/files")).raise_for_status().json()["files"].items():
                (WS / path).parent.mkdir(parents=True, exist_ok=True)
                (WS / path).write_text(text)
        with open(transcript, "a") as f:
            f.write("\n".join(lines) + "\n\n")
        return {"messages": [AIMessage("\n".join(lines))]}


scenario = Scenario()
