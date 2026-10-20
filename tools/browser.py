"""The family's browser, kept replaceable: Chrome holds the session (logins, carts) in
family/.browser and stays open between calls; a driver script does the clicking over CDP.
To swap browser-use for another driver, point DRIVER at a script with the same contract:
`uv run --script DRIVER <cdp_url> <task>` prints `RESULT: <what happened or what's needed>`."""
import os
import subprocess
import time
import urllib.request
from pathlib import Path

from langchain_core.tools import tool

ROOT = Path(__file__).parent.parent
PROFILE = ROOT / "family/.browser"
CHROME = os.getenv("CHROME_PATH", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
CDP = "http://localhost:9222"
DRIVER = ROOT / "tools/browser_use_driver.py"


def chrome() -> str:
    """Start Chrome on the saved profile unless it's already running."""
    for attempt in range(30):
        try:
            urllib.request.urlopen(f"{CDP}/json/version", timeout=1)
            return CDP
        except OSError:
            if attempt == 0:
                subprocess.Popen([CHROME, "--remote-debugging-port=9222", f"--user-data-dir={PROFILE}", "--no-first-run"],
                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            time.sleep(1)
    raise RuntimeError("Chrome didn't start")


@tool
def browse(task: str) -> str:
    """Do one step of an errand in the family's browser (logged-in sessions and open pages persist
    between calls). Give a self-contained task: the site, what to do, the details to use, and where to
    stop. It stops and reports when it needs an OTP, a login, a choice, or before booking or paying."""
    run = subprocess.run(["uv", "run", "--quiet", "--script", str(DRIVER), chrome(), task],
                         capture_output=True, text=True, timeout=900, env={**os.environ, "ANONYMIZED_TELEMETRY": "false"})
    result = run.stdout.rpartition("RESULT:")[2].strip()
    return result if run.stdout.count("RESULT:") else f"The browser failed: {run.stderr[-1500:]}"
