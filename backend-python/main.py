# backend-python/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.sockets import router as socket_router

app = FastAPI(title="AuraOS ML Audio Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(socket_router)

@app.get("/")
def read_root():
    return {"status": "AuraOS Audio Engine is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)