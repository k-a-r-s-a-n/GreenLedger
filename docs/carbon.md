# Carbon Footprint Calculation & Conversion Methodology

## Conversion Formulas
GreenLedger converts predicted electrical wattage into standard units of carbon equivalent ($g\ CO_2e$):

$$\text{Energy (kWh)} = \left(\frac{\text{Power (Watts)}}{1000}\right) \times \text{Duration (Hours)}$$

$$\text{Emissions } (kg\ CO_2e) = \text{Energy (kWh)} \times \text{Carbon Intensity } \left(\frac{kg\ CO_2e}{kWh}\right)$$

$$\text{Emissions } (g\ CO_2e) = \text{Emissions } (kg\ CO_2e) \times 1000$$

---

## Regional Grid Emission Factors

| Region | Grid Factor ($kg\ CO_2e / kWh$) | Authority / Source |
|---|---|---|
| **United States** | `0.385` | US EPA eGRID National Average |
| **European Union** | `0.230` | European Environment Agency (EEA) |
| **United Kingdom** | `0.165` | National Grid ESO |
| **Germany** | `0.348` | Umweltbundesamt (UBA) |
| **India** | `0.710` | Central Electricity Authority (CEA) |
| **Nordic Hydro/Nuclear** | `0.045` | Nordic Clean Energy Baseline |
| **Certified Renewable** | `0.015` | Wind / Solar Lifecycle Assessment |

---

## Environmental Equivalencies
- **Mature Tree Offset**: One mature tree absorbs approximately $21,770\ g\ CO_2$ per year ($59.64\ g\ CO_2/\text{day}$).
- **Passenger Vehicle Mileage**: An average passenger car emits approximately $120\ g\ CO_2/\text{km}$.
