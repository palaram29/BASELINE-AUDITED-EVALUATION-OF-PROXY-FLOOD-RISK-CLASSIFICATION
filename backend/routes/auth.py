from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field

from backend.config import CITIES
from backend.services import auth_service
from backend.services.auth_service import AuthError

router = APIRouter(prefix="/auth", tags=["Auth"])

security = HTTPBearer()


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    phone: str | None = Field(None, max_length=30)
    password: str = Field(..., min_length=8, max_length=128)
    alert_city: str = Field(..., description="City to receive flood alerts for, e.g. 'Colombo'.")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class UpdateAlertCityRequest(BaseModel):
    alert_city: str


class UpdateProfileRequest(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=120)
    phone: str | None = Field(None, max_length=30)
    email: EmailStr | None = None


class DeleteAccountRequest(BaseModel):
    password: str = Field(..., min_length=1, description="Current password, required to confirm deletion.")


def _validate_city(city):
    if city not in CITIES:
        raise HTTPException(status_code=422, detail=f"'{city}' is not a monitored city.")


def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> int:
    try:
        return auth_service.decode_access_token(credentials.credentials)
    except AuthError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/cities")
def list_alert_cities():
    """Cities a user can pick for alerts - the same list the ML model is
    trained/predicts on, so every registered city always has real
    prediction data behind it."""

    return CITIES


@router.post("/register")
def register(payload: RegisterRequest):
    _validate_city(payload.alert_city)

    try:
        return auth_service.register_user(
            full_name=payload.full_name,
            email=payload.email,
            phone=payload.phone,
            password=payload.password,
            alert_city=payload.alert_city,
        )
    except AuthError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login")
def login(payload: LoginRequest):
    try:
        return auth_service.authenticate_user(payload.email, payload.password)
    except AuthError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/me")
def me(user_id: int = Depends(get_current_user_id)):
    try:
        return auth_service.get_user_by_id(user_id)
    except AuthError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/me/alert-city")
def update_alert_city(payload: UpdateAlertCityRequest, user_id: int = Depends(get_current_user_id)):
    _validate_city(payload.alert_city)

    try:
        return auth_service.update_alert_city(user_id, payload.alert_city)
    except AuthError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/me")
def update_profile(payload: UpdateProfileRequest, user_id: int = Depends(get_current_user_id)):
    """Edit full_name/phone/email. Any field omitted (left as null) is
    left unchanged - alert_city has its own endpoint above."""

    try:
        return auth_service.update_profile(
            user_id,
            full_name=payload.full_name,
            phone=payload.phone,
            email=payload.email,
        )
    except AuthError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/me")
def delete_account(payload: DeleteAccountRequest, user_id: int = Depends(get_current_user_id)):
    """Permanently deletes the account. Requires the current password -
    see auth_service.delete_account for why."""

    try:
        auth_service.delete_account(user_id, payload.password)
    except AuthError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"deleted": True}
