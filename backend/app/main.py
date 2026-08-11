from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="FINCRIME COMMAND API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SAMPLE_EVENTS = [
    {
        "id": 1,
        "title": "IQTFS local sanctions / freezing list update detected",
        "country": "Iraq",
        "category": "iqtfs",
        "source": "IQTFS",
        "priority": "Critical",
        "published_at": "2026-08-11"
    },
    {
        "id": 2,
        "title": "FATF / FSRB jurisdiction update",
        "country": "Global",
        "category": "fatf",
        "source": "FATF",
        "priority": "High",
        "published_at": "2026-08-11"
    }
]

@app.get("/health")
def health():
    return {"status": "ok", "service": "fincrime-command-api"}

@app.get("/events")
def events():
    return SAMPLE_EVENTS

@app.get("/sources")
def sources():
    return [
        {"name": "IQTFS", "priority": True},
        {"name": "FATF", "priority": True},
        {"name": "MENAFATF", "priority": True},
        {"name": "OFAC", "priority": True},
        {"name": "UN Security Council", "priority": True},
        {"name": "Egmont Group", "priority": False},
        {"name": "INTERPOL", "priority": False},
        {"name": "Reuters", "priority": False, "licensed": True}
    ]
