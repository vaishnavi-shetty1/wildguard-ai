from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional, Literal


VALID_SPECIES = {"elephant", "tiger", "leopard", "unknown"}


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
    sms_sent: bool
    image_b64: Optional[str]

    model_config = {"from_attributes": True}


class DetectionAck(BaseModel):
    """Acknowledgement returned immediately after POST /detections."""

    id: int
    message: str
    sms_queued: bool
