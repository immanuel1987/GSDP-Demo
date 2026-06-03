FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY app.py config.py data_access.py search_backend.py ontology_review.py app.yaml ./

EXPOSE 8000

CMD ["streamlit", "run", "app.py", "--server.port", "8000", "--server.address", "0.0.0.0", "--server.headless", "true", "--browser.gatherUsageStats", "false"]
