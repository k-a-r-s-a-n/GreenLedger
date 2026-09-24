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
    # Phase 1 ground truth: battery drain-rate reference signal (agent-derived;
    # None when plugged in, charging, or capacity unknown).
    battery_drain_pct_per_hr: Optional[float] = None
    battery_drain_w: Optional[float] = None
    battery_capacity_wh: Optional[float] = None
    # v1.1.0 model signals (display + DVFS awareness)
    screen_brightness: Optional[float] = Field(None, ge=0.0, le=100.0)
    cpu_frequency_mhz: Optional[float] = Field(None, ge=0.0)
    power_saver_active: Optional[int] = Field(None, ge=0, le=1)
    top_cpu_processes: Optional[List[Dict[str, Any]]] = None
    top_memory_processes: Optional[List[Dict[str, Any]]] = None
    # User-attention signals (agent-derived; None when unsupported): the zombie
    # safety gate never recommends killing the foreground process.
    foreground_process_name: Optional[str] = None
    input_idle_seconds: Optional[float] = None


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
    # Predicted NET watts (gross minus transition cost) with its basis string;
    # null when inputs are missing. Advisory only — verification mints credits.
    predicted_net_w: Optional[float] = None
    prediction_basis: Optional[str] = None


class OptimizationExecuteRequest(BaseModel):
    action_id: str
    params: Optional[Dict[str, Any]] = None


class SequencePredictRequest(BaseModel):
    """A trailing telemetry window (oldest first, 1-120 ticks) for the
    temporal LSTM. Intervals describe the LAST tick."""
    telemetry_window: List[Dict[str, Any]] = Field(..., min_length=1, max_length=120)


class SequencePredictResponse(BaseModel):
    q10_w: float
    median_w: float
    q90_w: float
    interval_80_w: List[float]
    window_ticks: int
    model_version: str
    warnings: List[str] = []


class DeltaEvaluationRequest(BaseModel):
    action_id: str
    before_telemetry: Dict[str, Any]
    after_telemetry: Dict[str, Any]
    user_id: str = "default_user"
    # Optional raw sample windows behind each median snapshot; when supplied
    # (and the temporal model is available) the response carries 80% power
    # intervals for honest significance reading.
    before_window: Optional[List[Dict[str, Any]]] = None
    after_window: Optional[List[Dict[str, Any]]] = None
    # Client-echoed prediction from the recommendation card (if shown), logged
    # against the verified outcome for recommender calibration. Never affects
    # verification or payouts.
    predicted_net_w: Optional[float] = None


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
    # 80% power intervals [lo, hi] for each snapshot, when the caller supplied
    # sample windows and the temporal model is available; else null.
    before_power_interval_80: Optional[List[float]] = None
    after_power_interval_80: Optional[List[float]] = None


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
