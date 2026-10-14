FROM python:3.13-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
ENV UV_HTTP_TIMEOUT=120
# Warm uv's cache once at build time so each trial's agent and verifier installs are local.
RUN uv python install 3.13 \
    && uv venv /tmp/warm --python 3.13 \
    && uv pip install --python /tmp/warm langgraph python-dotenv "deepagents>=0.7.25" langchain-openai typesafe-sdk \
    && rm -rf /tmp/warm \
    && uvx --from 'harbor-rewardkit==0.2.*' rewardkit --help > /dev/null
WORKDIR /app
