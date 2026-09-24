# Patent Landscape: Carbon-Footprint Reduction in Computing

Survey date: 2026-09-24. Source: Google Patents (`(carbon footprints reduction)`
returns ~123,700 documents — mostly agriculture, materials, and HVAC). This
note filters to the patents that actually touch GreenLedger's territory:
software power estimation, ML-driven power management, verified savings, and
individual carbon incentives. It is a positioning input for Phase 4, not a
freedom-to-operate opinion.

## 1. Predictive power management (closest prior art)

### US8190939B2 — Microsoft (Horvitz et al.), priority 2009, active to 2030
"Reducing power consumption of computing devices by forecasting computing
performance needs." Claim 1: build a model from historical system activities
that predicts the probability of a forthcoming workload reduction; match
current/recent activity against history; transition the processor to a reduced
P-state/C-state; includes breakeven analysis (only transition when net power
is saved after transition costs) and deferring low-priority tasks to extend
idle. Heavily cited (Intel sleep-state, cluster capacity patents cite it).
- What it is NOT: no measurement/verification of the saving after the fact,
  no uncertainty on any estimate, no carbon translation, no user incentives.
  It predicts workload and acts — it never checks its work.

### US10761584B2 — Vigyanlabs, granted 2020
"System and method to enable prediction-based power management." A
non-intrusive agent observes/records usage + idleness; a neural network learns
idleness patterns; predicts future idleness; transitions the device directly
to a lower power state. Vigyanlabs (Bangalore) is the closest *commercial*
competitor: 7 US patents, IPM+ product on desktops/laptops/phones for
enterprises and OEMs.
- What it is NOT: enterprise-fleet power-state control. No per-action
  verified savings, no intervals/significance, no consumer incentive loop.

### US11269677B2 — Vigyanlabs, granted 2022
"Analyze and optimize application level resource and energy consumption by
data center servers." Per-host, per-VM, per-application energy footprinting;
migrates VMs off underutilized hosts; predicts power-capping opportunities.
Datacenter scope — adjacent, not overlapping, with single-device optimization.

### US11966274B2 — Thakkar et al., granted 2024
"Datacenter carbon footprint climate impact reduction." Two-tier genetic
algorithm: tier 1 finds per-device-type coefficient ranges (servers, switches,
storage) that likely reduce carbon; tier 2 optimizes against actual
power-usage-based carbon scores; outputs are used for **power capping** under
performance constraints.
- Relevance: the only patent found that optimizes *carbon* (not just power)
  and lands on power capping — the same actuator family as our `cap_cpu_55`.
  But it is offline fleet optimization with no per-action verification loop.

### US12189449B2 — SUNY Research Foundation, granted 2025
"Energy aware processing load distribution." Predicts future physical/thermal
state across server systems and distributes load under thermal constraints.
Confirms predictive thermal/power control is still being granted — with
narrow claims around the prediction + constraint mechanism.

### Cluster power capping family
US8271807B2 / US9405348B2 (Adaptive Computing, 2008 priority): power-capping
jobs in clusters/grids/HPC. Old, datacenter-scoped, no learning component.

## 2. Carbon accounting + individual incentives (green-credits analogs)

### US20230038676A1 — Advanced New Technologies (Ant Group), 2023
"Calculating individual carbon footprints" (Ant Forest family). Behavior data
from internet-service use → per-service "carbon-saving quantity quantization
algorithm" → aggregated per-user carbon-saving quantity → user data/feedback.
- What it is NOT: lifestyle behavior (transit, e-payments), with savings from
  lookup tables, not measurement. No device power, no verification against
  metered quantities, no gaming-resistance mechanism in the claims.

### US20140114867A1 — application, 2014
"System for providing actions to reduce a carbon footprint." User-specific
energy input → emission data → prioritized custom actions → display; detects
automatable actions and performs them automatically.
- Broad but old and application-status; no learning, no verification loop.

### US10396581B2 — IBM, 2019
"Managing peak power consumption for distributed assets using battery
charging schedules." Uses batteries as a buffer for peak shaving — the
inverse of our approach (we read the battery as a *sensor*; they drive it as
an *actuator*). No conflict; potentially complementary citation.

## 3. The carbon-aware computing movement (papers + filings, not all granted)

- Google's Carbon-Intelligent Compute (Radovanovic et al., 2021): day-ahead
  carbon-intensity forecasts + demand prediction → Virtual Capacity Curves
  that delay flexible datacenter workloads. CPU-as-proxy power model, no
  per-device estimation, no verification loop.
- Microsoft "sustainability-aware" device behavior scheduler (filed ~2026 per
  press): holds device actions for lower grid-intensity windows using
  carbon-intensity + weather forecasts. Same *spirit* as carbon-aware
  timing, scoped to OS-scheduled actions, not user-initiated optimization
  with verified payouts.

## 4. Where the white space is (GreenLedger's differentiable claims)

No patent found combines, in one closed loop:

1. **Software power meter from OS telemetry** calibrated against a
   battery-drain-derived ground truth (discharge %/hr × design capacity).
   Patents either assume metered power (datacenter) or predict workload/idle
   states without estimating watts.
2. **Verified per-action savings with calibrated uncertainty** — before/after
   measurement windows, quantile intervals, and interval-non-overlap
   significance. The Microsoft '939 patent does breakeven analysis *before*
   acting; nobody found tests the saving *after* acting with uncertainty.
3. **Verified-savings → incentive payout with anti-gaming**: credits minted
   only from live, verified, hash-bound measurements with replay/velocity
   guards. Ant quantizes behavior with no measurement binding.
4. **Offline-learned policy from a transition log** (Phase 3): (state,
   action, verified outcome) tuples collected by the verification loop
   itself, used to pre-train the action policy. The prediction patents act
   from forecasting; none learn from verified outcomes of their own actions.

## 5. Implemented response (patent-gap build, 2026-09-24)

White-space items 2–4 are now built, not just claimed: predicted-net cards
with breakeven + foreground safety gates (`cost_models.py`), agent attention
signals, predicted-vs-actual transition logging, and `calibration.py`. Item
1 (drain-calibrated meter) is Phase 1's collector awaiting real-hardware
data. The Microsoft '939 distinction is now structural: we predict *watts
net of transition cost* per user action and verify after acting; they match
*workload probabilities* and transition P-states without verification.

## 6. Risks and watch items

- **Microsoft '939 (to 2030)**: our engine recommends P-state/power-plan
  changes, but on *current* observed state + verified outcomes, not on
  predicted-workload-probability matching — different mechanism, and we never
  auto-transition states without the user. Still the patent to distinguish
  most carefully in any filing.
- **Vigyanlabs portfolio**: nearest product overlap (endpoint agents,
  prediction). Our differentiation is verification + uncertainty + consumer
  incentives, none of which appear in their granted claims. Monitor new
  filings (they file steadily).
- **Ant carbon-quantization family**: broad "behavior → carbon-saving
  quantity" language. Ours is device-measured, not behavior-declared — keep
  that distinction sharp in any claims.
- CPC clusters to watch: G06F1/32 (power saving), G06F11/30 (monitoring),
  G06Q30 (incentives), G06N3/08 (learning methods).

## Key references

- https://patents.google.com/patent/US8190939B2/en (Microsoft predictive P-states)
- https://patents.google.com/patent/US10761584B2/en (Vigyanlabs prediction-based PM)
- https://patents.google.com/patent/US11269677B2/en (Vigyanlabs app-level DC energy)
- https://patents.google.com/patent/US11966274B2/en (two-tier GA carbon → power capping)
- https://patents.google.com/patent/US12189449B2/en (SUNY predictive thermal distribution)
- https://patents.google.com/patent/US20230038676A1/en (Ant individual carbon footprints)
- https://patents.google.com/patent/US20140114867A1/en (personalized carbon actions)
- https://patents.google.com/patent/US10396581B2/en (IBM battery peak shaving)
- https://arxiv.org/pdf/2106.11750 (Google carbon-aware datacenters)
