"""
GreenLedger - Carbon & Emission API Router
"""

from typing import Dict, Any
from fastapi import APIRouter
from schemas.models import CarbonRequest, CarbonResponse
from services.carbon.calculator import (
    power_to_kwh, 
    kwh_to_co2, 
    DEFAULT_CARBON_INTENSITY
)

router = APIRouter(prefix="/api/carbon", tags=["Carbon Calculator"])

# Verified regional electricity carbon intensities (kg CO2e / kWh)
REGIONAL_FACTORS = {
    "us_average": {"name": "United States (eGRID Avg)", "intensity": 0.385},
    "eu_average": {"name": "European Union (EEA Avg)", "intensity": 0.230},
    "uk": {"name": "United Kingdom (National Grid)", "intensity": 0.165},
    "germany": {"name": "Germany (UBA)", "intensity": 0.348},
    "india": {"name": "India (CEA Grid Avg)", "intensity": 0.710},
    "nordic": {"name": "Nordic Clean Hydro/Nuclear", "intensity": 0.045},
    "100_renewable": {"name": "Certified 100% Renewable", "intensity": 0.015}
}


@router.post("/calculate", response_model=CarbonResponse)
def calculate_carbon_footprint(req: CarbonRequest):
    """Converts instantaneous or sustained wattage into kWh and CO2e emissions."""
    intensity = req.carbon_intensity_kg_per_kwh or DEFAULT_CARBON_INTENSITY
    kwh = power_to_kwh(req.power_watts, req.duration_hours)
    res = kwh_to_co2(kwh, intensity)
    
    return CarbonResponse(
        power_watts=req.power_watts,
        duration_hours=req.duration_hours,
        energy_kwh=res["energy_kwh"],
        carbon_intensity_kg_per_kwh=intensity,
        emissions_g_co2=res["emissions_g_co2"],
        emissions_kg_co2=res["emissions_kg_co2"],
        trees_offset_equivalent=res["trees_offset_equivalent"],
        car_km_equivalent=res["car_km_equivalent"]
    )


@router.get("/factors")
def get_emission_factors() -> Dict[str, Any]:
    """Returns transparent regional grid carbon emission factors."""
    return REGIONAL_FACTORS
