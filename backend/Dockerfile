FROM python:3.11

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY . .

RUN pip install --upgrade pip

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 2005

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "2005"]
