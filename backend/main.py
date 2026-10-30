import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from backend.core.config import settings
from backend.core.database import connect_to_mongo, close_mongo_connection
from backend.routers import auth, prescriptions, reminders, alerts, caregivers, doctors, maps
from backend.agent.server import router as agent_router
from backend.services.notification import notification_manager
from backend.services.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("smart_med_reminder")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info(f"Starting {settings.APP_NAME}...")
    await connect_to_mongo()
    start_scheduler()
    yield
    # Shutdown
    logger.info(f"Shutting down {settings.APP_NAME}...")
    stop_scheduler()
    await close_mongo_connection()


app = FastAPI(
    title=settings.APP_NAME,
    description="Full-stack AI-first healthcare medication assistant powered by Gemma 4 and Google ADK.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers under /api/v1 prefix
app.include_router(auth.router, prefix="/api/v1")
app.include_router(prescriptions.router, prefix="/api/v1")
app.include_router(reminders.router, prefix="/api/v1")
app.include_router(alerts.router, prefix="/api/v1")
app.include_router(caregivers.router, prefix="/api/v1")
app.include_router(doctors.router, prefix="/api/v1")
app.include_router(maps.router, prefix="/api/v1")
app.include_router(agent_router, prefix="/api/v1")


@app.get("/")
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "model": settings.GEMMA_MODEL_ID,
        "version": "1.0.0"
    }


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await notification_manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo or process client events
            await websocket.send_json({"type": "PONG", "message": "Connection active"})
    except WebSocketDisconnect:
        notification_manager.disconnect(user_id, websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=settings.PORT, reload=True)

