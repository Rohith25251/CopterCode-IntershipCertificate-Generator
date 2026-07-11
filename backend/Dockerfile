# Use a lightweight official Python image
FROM python:3.11-slim

# Install LibreOffice, fonts, and cleaning up cache
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-impress \
    libreoffice-core \
    fonts-liberation \
    fonts-dejavu \
    fontconfig \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Pre-warm LibreOffice's user profile once at build time to avoid
# first-request slowness in production
RUN soffice --headless --terminate_after_init \
    --env:UserInstallation=file:///tmp/lo_profile_warmup || true

# LibreOffice requires HOME to write profile data
ENV HOME=/tmp

# Set working directory
WORKDIR /app

# Copy dependency list and install them
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all backend files
COPY . .

# Copy custom fonts to system fonts folder and rebuild cache so LibreOffice can render them
RUN mkdir -p /usr/share/fonts/truetype/custom && \
    cp fonts/*.ttf /usr/share/fonts/truetype/custom/ && \
    fc-cache -f -v

# Expose FastAPI port
EXPOSE 5000

# Run FastAPI app with Uvicorn
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5000"]
