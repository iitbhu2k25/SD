FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/home/app
RUN apt-get update && apt-get install -y \
    wget \
    build-essential \
    libreadline-dev \
    libncursesw5-dev \
    libssl-dev \
    libsqlite3-dev \
    tk-dev \
    libgdbm-dev \
    libc6-dev \
    libbz2-dev \
    libffi-dev \
    zlib1g-dev \
    gdal-bin \
    libgdal-dev \
    binutils \
    libproj-dev \
    python3-distutils \
    curl \
    libpq-dev \ 
    gcc \
    && rm -rf /var/lib/apt/lists/*


RUN wget https://www.python.org/ftp/python/3.12.9/Python-3.12.9.tgz && \
    tar -xf Python-3.12.9.tgz && \
    cd Python-3.12.9 && \
    ./configure --enable-optimizations && \
    make altinstall && \
    cd .. && \
    rm -rf Python-3.12.9 Python-3.12.9.tgz


RUN ln -sf /usr/local/bin/python3.12 /usr/bin/python && \
    ln -sf /usr/local/bin/python3.12 /usr/bin/python3 && \
    ln -sf /usr/local/bin/pip3.12 /usr/bin/pip && \
    ln -sf /usr/local/bin/pip3.12 /usr/bin/pip3


RUN python --version

# Set the working directory in the container
WORKDIR /home/app

# Set GDAL environment variables
ENV CPLUS_INCLUDE_PATH=/usr/include/gdal
ENV C_INCLUDE_PATH=/usr/include/gdal

# Make sure GDAL Python package matches system GDAL version
RUN GDAL_VERSION=$(gdal-config --version) && \
    pip install --upgrade pip && \
    pip install GDAL==${GDAL_VERSION}

# Create non-root user for security
RUN useradd -m -s /bin/bash appuser

# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy the project files to the container
COPY . .

# Set correct ownership
RUN chown -R appuser:appuser /home/app

# Switch to non-root user
USER appuser

# Expose the port FastAPI will run on
EXPOSE 7000