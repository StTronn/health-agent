# /// script
# requires-python = ">=3.11"
# dependencies = ["browser-use==0.13.11", "python-dotenv"]
# ///
"""browser-use driver: attaches to the running Chrome, does one task, prints `RESULT: ...`.
Runs in its own environment (browser-use pins its own openai version)."""
import asyncio
import sys
from pathlib import Path

from browser_use import Agent, Browser, ChatOpenAI
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")
MODEL = "gpt-6.1-sol"
RULES = """You act for a family on health sites (lab tests, medicines). Work in the current tab if it's on the right site.
Stop and report (call done) instead of guessing when you need: an OTP or password, a login, any detail the task didn't give,
or a choice between options that matter (test package, slot, product, pack size). Never book, place an order or pay unless the
task says the family has confirmed it. When you stop, report: where you are, what you found (names, prices, slots, totals),
and exactly what you need next. Leave the page open; never close the tab."""


async def main(cdp_url: str, task: str) -> None:
    agent = Agent(task=task, llm=ChatOpenAI(model=MODEL, reasoning_models=[MODEL]),
                  browser=Browser(cdp_url=cdp_url, keep_alive=True), extend_system_message=RULES)
    history = await agent.run(max_steps=60)
    print("RESULT:", history.final_result() or f"Stopped without finishing. Errors: {history.errors()[-3:]}")


asyncio.run(main(sys.argv[1], sys.argv[2]))
