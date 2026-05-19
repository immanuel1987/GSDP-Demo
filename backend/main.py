from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import auth
from routes import ontology
from salesianonline_rag.app import mount_rag_ui




# Create database tables


@asynccontextmanager
async def lifespan(app: FastAPI):
    # RAG is mounted below; this hook confirms the module ran with the API process.
    print("[startup] Salesian Online RAG UI (HTML) at /rag")
    yield


app = FastAPI(title="Global Salesian Digital Platform Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5050",
        "http://localhost:2005",
        "http://127.0.0.1:2005",
        "https://gsdp-dev.cristoerp.com",
        "https://demo-global-galesian-digital-platform.imman.workers.dev",
        "https://globalsalesiandigitalplatform.jamesrubert.workers.dev",
        "https://gsdp-7474649503171619.aws.databricksapps.com"
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the auth router
app.include_router(auth.router)
app.include_router(ontology.router)

mount_rag_ui(app, path="/rag")


@app.get("/")
def read_root():
    return {
        "message": "Welcome to the Global Salesian Digital Platform API (v1.0.1)",
        "salesian_online_rag_ui": "/rag",
    }

@app.get("/health")
def health_check():
    return {"status": "ok"}