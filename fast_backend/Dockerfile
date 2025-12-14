FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/home/app

# Install system dependencies + GDAL
RUN apt-get update && apt-get install -y \
    gdal-bin \
    libgdal-dev \
    libproj-dev \
    libpq-dev \
    binutils \
    gcc \
    build-essential \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Set GDAL include paths
ENV CPLUS_INCLUDE_PATH=/usr/include/gdal
ENV C_INCLUDE_PATH=/usr/include/gdal
ENV GDAL_CONFIG=/usr/bin/gdal-config

# Set working directory
WORKDIR /home/app

# Upgrade pip & build tools
RUN python -m pip install --upgrade pip setuptools wheel

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt


# Create non-root user
RUN useradd -m appuser && chown -R appuser:appuser /home/app
USER appuser

EXPOSE 7000
