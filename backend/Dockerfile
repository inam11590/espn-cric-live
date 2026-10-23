# Production Dockerfile for CricStream Live Backend Engine
FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    DATABASE_URL=sqlite:////app/data/cricket.db

WORKDIR /app

# Install system dependencies needed for Playwright WebKit and health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Install Playwright WebKit browser binary and its system OS libraries
RUN playwright install --with-deps webkit && \
    rm -rf /var/lib/apt/lists/*

# Create persistent storage directories
RUN mkdir -p /app/data /app/logs

# Copy project code
COPY espncricinfo/ /app/espncricinfo/
COPY backend/ /app/backend/
COPY fixtures/ /app/fixtures/
COPY run.py /app/run.py

# Create non-root application user for production security
RUN useradd -m -u 1000 -s /bin/bash appuser && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

# Production Uvicorn invocation with 2 workers and proxy headers forwarded from Nginx
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--proxy-headers", "--forwarded-allow-ips=*"]
