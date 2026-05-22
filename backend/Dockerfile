FROM python:3.11

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY . .

RUN pip install --upgrade pip

RUN pip install \
fastapi==0.115.0 \
uvicorn==0.30.0 \
gradio==4.31.4 \
huggingface_hub==0.23.5 \
numpy==1.26.4 \
pandas==2.2.2 \
MarkupSafe==2.1.5 \
jinja2==3.1.4 \
openai \
sqlalchemy \
psycopg2-binary \
python-dotenv \
requests \
databricks-vectorsearch \
bcrypt==5.0.0 \
databricks-sql-connector

EXPOSE 2005

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "2005"]
