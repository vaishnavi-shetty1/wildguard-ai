from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional, Literal


VALID_SPECIES = {"elephant", "tiger", "leopard", "unknown"}
VALID_ROLES = {"admin", "operator", "landowner", "village_head"}


# ── Detection schemas ──────────────────────────────────────────────────────────


class DetectionCreate(BaseModel):
    """Payload sent by the Raspberry Pi on each confirmed detection."""

    species: str = Field(..., description="Detected species name")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence (0–1)")

    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    gps_fix: bool = Field(False, description="True if GPS had a valid satellite fix")

    device_id: str = Field("unit-01", max_length=64)
    detected_at: Optional[datetime] = Field(
        None,
        description="ISO-8601 timestamp from the Pi (server time used if omitted)",
    )

    # Optional: base64-encoded JPEG thumbnail (~50 KB max recommended)
    image_b64: Optional[str] = Field(None, description="Base64-encoded JPEG thumbnail")

    @field_validator("species")
    @classmethod
    def normalise_species(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in VALID_SPECIES:
            raise ValueError(f"species must be one of {sorted(VALID_SPECIES)}")
        return v


class DetectionOut(BaseModel):
    """Detection record returned to API consumers."""

    id: int
    species: str
    confidence: float
    latitude: Optional[float]
    longitude: Optional[float]
    gps_fix: bool
    detected_at: datetime
    device_id: str
    status: Optional[str] = "active"
    alert_level: Optional[str] = None
    sms_sent: bool
    image_b64: Optional[str]

    model_config = {"from_attributes": True}


class DetectionUpdate(BaseModel):
    status: Optional[str] = Field(None, pattern="^(active|resolved|dismissed)$")
    alert_level: Optional[str] = Field(None, pattern="^(LOW|MEDIUM|HIGH|CRITICAL)$")


class DetectionAck(BaseModel):
    """Acknowledgement returned immediately after POST /detections."""

    id: int
    message: str
    sms_queued: bool


# ── Auth / User schemas ────────────────────────────────────────────────────────


class UserCreate(BaseModel):
    username: str = Field(..., min_length=2, max_length=64)
    email: str = Field(..., max_length=128)
    password: str = Field(..., min_length=6, max_length=128)
    role: str = Field("operator")
    phone: str = Field("")
    location_name: str = Field("")
    sms_alerts_enabled: bool = Field(True)

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in VALID_ROLES:
            raise ValueError(f"role must be one of {sorted(VALID_ROLES)}")
        return v

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        return v.strip().lower()


class UserLogin(BaseModel):
    email: str
    password: str


class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=2, max_length=64)
    email: Optional[str] = Field(None, max_length=128)
    role: Optional[str] = Field(None)
    phone: Optional[str] = None
    location_name: Optional[str] = None
    sms_alerts_enabled: Optional[bool] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=6, max_length=128)

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_ROLES:
            raise ValueError(f"role must be one of {sorted(VALID_ROLES)}")
        return v

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: Optional[str]) -> Optional[str]:
        return v.strip().lower() if v else v


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    role: str
    phone: str
    location_name: str
    sms_alerts_enabled: bool
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ── SMS schemas ────────────────────────────────────────────────────────────────


class SmsSendRequest(BaseModel):
    recipient_ids: list[int] = Field(default_factory=list)
    message: str = Field(..., min_length=1, max_length=512)
    trigger_type: str = Field("manual_broadcast")
    sector: Optional[str] = Field(None, max_length=128)
    sighting_id: Optional[str] = Field(None, max_length=64)


class SmsLogOut(BaseModel):
    id: int
    timestamp: datetime
    recipient_phone: str
    recipient_name: str
    recipient_role: str
    message: str
    status: str
    trigger_type: str
    sighting_id: Optional[str]
    sector: Optional[str]

    model_config = {"from_attributes": True}


class SmsConfigOut(BaseModel):
    auto_alert_enabled: bool
    alert_levels: list[str]
    selected_species: list[str]
    default_sender_name: str
    twilio_configured: bool


class SmsConfigUpdate(BaseModel):
    auto_alert_enabled: Optional[bool] = None
    alert_levels: Optional[list[str]] = None
    selected_species: Optional[list[str]] = None
    default_sender_name: Optional[str] = None
    twilio_configured: Optional[bool] = None


# ── Alerts / SOS schemas ───────────────────────────────────────────────────────


class SosRequest(BaseModel):
    location: Optional[str] = Field(None, max_length=128)
    message: Optional[str] = Field(None, max_length=512)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)


class SosOut(BaseModel):
    acknowledged: bool
    message: str
    broadcast_count: int


# ── System log schemas ─────────────────────────────────────────────────────────


class SystemLogOut(BaseModel):
    id: int
    timestamp: datetime
    user: str
    ip: str
    action: str
    details: str
    is_suspicious: bool

    model_config = {"from_attributes": True}


