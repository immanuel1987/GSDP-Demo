FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    pkg-config \
    cargo \
    rustc \
    libpq-dev \
    libffi-dev \
    libssl-dev \
    libxml2-dev \
    libxslt-dev \
    zlib1g-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip setuptools wheel

COPY requirements.txt .

RUN pip install --no-deps -r requirements.txt

COPY . .

EXPOSE 2005

HEALTHCHECK CMD curl --fail http://localhost:2005/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "2005"]