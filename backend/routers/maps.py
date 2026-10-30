from fastapi import APIRouter
from backend.agent.tools.maps_tool import find_hospitals

router = APIRouter(prefix="/maps", tags=["Maps & Emergency"])


@router.get("/hospitals")
async def get_nearby_hospitals(lat: float = -1.1492, lng: float = 36.9634, radius: float = 10.0):
    return find_hospitals(latitude=lat, longitude=lng, radius_km=radius)

