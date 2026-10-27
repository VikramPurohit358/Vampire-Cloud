# syntax=docker/dockerfile:1
FROM python:3.12-slim AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install dependencies in a separate layer for caching.
COPY worker/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy the worker package source.
COPY worker ./worker
COPY pyproject.toml ./

# Run as a non-root user for security.
RUN useradd -m worker && chown -R worker:worker /app
USER worker

# VAMP_MASTER_URL and VAMP_WALLET are expected at runtime.
ENV VAMP_MASTER_URL=ws://master:8080/worker

CMD ["python", "-m", "worker"]
