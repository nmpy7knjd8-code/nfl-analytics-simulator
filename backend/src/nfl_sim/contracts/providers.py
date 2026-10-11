from enum import Enum

from pydantic import BaseModel

from .enums import DataMode


class ProviderStatus(str, Enum):
    CONFIGURED = "configured"
    UNCONFIGURED = "unconfigured"
    DEMO = "demo"
    ERROR = "error"


class LiveProviderId(str, Enum):
    DEMO = "demo"
    ESPN_PUBLIC = "espn_public"
    NFL_OFFICIAL = "nfl_official"
    CUSTOM_WEBHOOK = "custom_webhook"


class ProviderDescriptor(BaseModel):
    id: LiveProviderId
    display_name: str
    mode: DataMode
    status: ProviderStatus
    capabilities: list[str]
    notes: str | None = None
