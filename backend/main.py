from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import auth
from routes import ontology




# Create database tables


app = FastAPI(title="Global Salesian Digital Platform Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
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

@app.get("/")
def read_root():
    return {"message": "Welcome to the Global Salesian Digital Platform API"}
