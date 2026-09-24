"""
GreenLedger - Pydantic Data Models & Schemas
Type-safe request and response contracts for all API endpoints.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class TelemetryInput(BaseModel):
    timestamp: Optional[str] = None
    is_live: Optional[bool] = False
    cpu_utilization: float = Field(..., ge=0.0, le=100.0, description="CPU usage percentage")
    memory_usage: float = Field(..., ge=0.0, le=100.0, description="RAM usage percentage")
    disk_io: float = Field(0.0, ge=0.0, description="Disk I/O rate in MB/s")
    network_latency: Optional[float] = Field(None, ge=0.0, description="Network ping latency in ms")
    process_count: int = Field(..., ge=1, description="Active system process count")
    thread_count: Optional[int] = Field(None, ge=1, description="Total active threads")
    context_switches: Optional[int] = Field(None, ge=0, description="Context switches count or rate")
    temperature: Optional[float] = Field(None, ge=0.0, le=120.0, description="System temperature in Celsius")
    uptime: Optional[float] = Field(None, ge=0.0, description="System uptime in hours")
    
    # Extended hardware telemetry
    gpu_name: Optional[str] = None
    gpu_utilization: Optional[float] = Field(None, ge=0.0, le=100.0)
    cpu_frequency: Optional[float] = None
    cpu_per_core: Optional[List[float]] = None
    memory_used_gb: Optional[float] = None
    memory_total_gb: Optional[float] = None
    disk_read_mbs: Optional[float] = None
    disk_write_mbs: Optional[float] = None
    network_throughput_kbs: Optional[float] = None
    battery_percentage: Optional[float] = None
    power_plugged: Optional[bool] = None
    power_meter_raw: Optional[float] = None
    # v1.1.0 model signals (display + DVFS awareness)
    screen_brightness: Optional[float] = Field(None, ge=0.0, le=100.0)
    cpu_frequency_mhz: Optional[float] = Field(None, ge=0.0)
    power_saver_active: Optional[int] = Field(None, ge=0, le=1)
    top_cpu_processes: Optional[List[Dict[str, Any]]] = None
    top_memory_processes: Optional[List[Dict[str, Any]]] = None


class PredictionResponse(BaseModel):
    estimated_power_w: float = Field(..., description="Predicted total power in Watts")
    model_version: str
    warnings: List[str] = []
    inference_latency_ms: float
    feature_contributions: Dict[str, float] = {}
    is_out_of_distribution: bool = False


class CarbonRequest(BaseModel):
    power_watts: float = Field(..., ge=0.0)
    duration_hours: float = Field(1.0, ge=0.0)
    carbon_intensity_kg_per_kwh: Optional[float] = Field(0.385, ge=0.0)


class CarbonResponse(BaseModel):
    power_watts: float
    duration_hours: float
    energy_kwh: float
    carbon_intensity_kg_per_kwh: float
    emissions_g_co2: float
    emissions_kg_co2: float
    trees_offset_equivalent: float
    car_km_equivalent: float


class OptimizationRecommendation(BaseModel):
    id: str
    title: str
    category: str
    priority: str
    estimated_power_reduction_pct: Optional[float] = None
    reversible: bool
    description: str
    action_name: str
    pid: Optional[int] = None
    process_name: Optional[str] = None
    cpu_percent: Optional[float] = None
    memory_percent: Optional[float] = None


class OptimizationExecuteRequest(BaseModel):
    action_id: str
    params: Optional[Dict[str, Any]] = None


class DeltaEvaluationRequest(BaseModel):
    action_id: str
    before_telemetry: Dict[str, Any]
    after_telemetry: Dict[str, Any]
    user_id: str = "default_user"


class BeforeAfterComparison(BaseModel):
    action_id: str
    before_power_w: float
    after_power_w: float
    reduction_watts: float
    reduction_pct: float
    hourly_co2_saved_g: float
    credits_awarded: int
    new_credit_balance: int
    streak_days: int
    action_hash: str
    unlocked_badge: Optional[str] = None


class GreenCreditState(BaseModel):
    user_id: str
    credit_balance: int
    lifetime_reduction_g_co2: float
    lifetime_energy_saved_kwh: float
    total_optimizations: int
    current_streak_days: int
    rank_title: str
    recent_transactions: List[Dict[str, Any]] = []


class Badge(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    rarity: str  # Common, Rare, Epic, Legendary
    credit_price: int
    unlock_criteria: str
    is_unlocked: bool
    token_id: Optional[int] = None
    minted_on_chain: bool = False
    tx_hash: Optional[str] = None


class MarketplacePurchaseRequest(BaseModel):
    badge_id: str
    user_id: Optional[str] = "default_user"


class MarketplacePurchaseResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    badge: Optional[Badge] = None
    new_balance: Optional[int] = None
    error: Optional[str] = None


class BlockchainVerifyRequest(BaseModel):
    tx_hash: str
    token_id: int
    badge_id: str
    user_wallet: str
    user_id: str = "default_user"


class MintVerificationResponse(BaseModel):
    verified: bool
    tx_hash: str
    token_id: int
    badge_id: str
    user_wallet: str
    explorer_url: str
    message: str
