"""Shelter management (operator console) and nearest-shelter lookup
(citizen app). Read endpoints (list, nearest) stay open, since the
citizen app must browse shelters without logging in.

Write endpoints (create, update, delete) require an X-Operator-Key
header matching OPERATOR_API_KEY. The operator console has no session
login of its own anywhere (see docs/ML_METHODOLOGY_AND_LIMITATIONS.md -
this is a deliberate, documented architectural decision, not an
oversight), so backend/routes/auth.py's citizen-account login is the
wrong mechanism to reuse here: it would require an operator to hold a
citizen alert-city account just to manage shelters, and the operator
console has no citizen-login flow to obtain that token at all. A shared
operator key is a smaller, honestly-scoped fix for a research prototype
that closes the specific gap the supervisor review flagged - unrestricted
public write access - without inventing a full session-auth system
across the whole console. See backend/routes/operator_auth.py.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from backend.routes.operator_auth import require_operator_key
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


@router.post("", dependencies=[Depends(require_operator_key)])
def create_shelter(payload: ShelterIn):
    return shelter_service.create_shelter(payload.model_dump())


@router.put("/{shelter_id}", dependencies=[Depends(require_operator_key)])
def update_shelter(shelter_id: int, payload: ShelterUpdate):
    updated = shelter_service.update_shelter(shelter_id, payload.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Shelter not found")
    return updated


@router.delete("/{shelter_id}", dependencies=[Depends(require_operator_key)])
def delete_shelter(shelter_id: int):
    deleted = shelter_service.delete_shelter(shelter_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Shelter not found")
    return {"deleted": True}
