from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.Acoustic_Signals.api.endpoints import acoustic_router

app = FastAPI(title="Biomedical Signal Viewer API")

# Configure CORS to allow requests from your React/Vite dev servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(acoustic_router)

@app.get("/")
def health_check():
    return {"status": "Biomedical API is running and ready to process signals."}