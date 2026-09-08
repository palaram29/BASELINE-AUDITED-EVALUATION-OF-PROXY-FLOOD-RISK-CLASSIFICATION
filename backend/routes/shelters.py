"""Shelter management (operator console) and nearest-shelter lookup
(citizen app). No auth check - same convention as backend/routes/admin.py,
mlops.py and reliability.py: this is trusted operator tooling with no
login of its own. See backend/services/shelter_service.py for why
"nearest" is straight-line ranking + a Maps hand-off, not road routing.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from backend.services import shelter_service

router = APIRouter(prefix="/shelters", tags=["Shelters"])


class ShelterIn(BaseModel):
    name: str = Field(min_length=1)
    type: str = Field(min_length=1)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    city: str = Field(min_length=1)
    capacity: Optional[int] = Field(default=None, ge=0)
    contact_phone: Optional[str] = None
    is_active: bool = True


class ShelterUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    type: Optional[str] = Field(default=None, min_length=1)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    city: Optional[str] = Field(default=None, min_length=1)
    capacity: Optional[int] = Field(default=None, ge=0)
    contact_phone: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("")
def list_shelters():
    return shelter_service.list_shelters()


@router.get("/nearest")
def nearest_shelters(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
):
    return shelter_service.nearest_shelters(lat, lon)


@router.post("")
def create_shelter(payload: ShelterIn):
    return shelter_service.create_shelter(payload.model_dump())


@router.put("/{shelter_id}")
def update_shelter(shelter_id: int, payload: ShelterUpdate):
    updated = shelter_service.update_shelter(shelter_id, payload.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Shelter not found")
    return updated


@router.delete("/{shelter_id}")
def delete_shelter(shelter_id: int):
    deleted = shelter_service.delete_shelter(shelter_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Shelter not found")
    return {"deleted": True}
