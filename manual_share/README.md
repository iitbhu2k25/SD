# Manual Mode — STP Suitability v2
Complete standalone code package. Every file is named with manual_ prefix.

---

## FRONTEND

### STEP 1 — Drop this whole folder into your project:
```
frontend/manual/  →  your stp_suitability_v2/manual/
```
Brand new folder, 16 files, zero conflict.

### STEP 2 — Add these files into their correct locations:

| File | Where to put it |
|---|---|
| `frontend/shared/manual_stpSuitabilityTypes.ts` | `services/manual_stpSuitabilityTypes.ts` |
| `frontend/shared/manual_stpSuitabilityApi.ts` | `services/manual_stpSuitabilityApi.ts` |
| `frontend/shared/manual_panels.config.ts` | `config/manual_panels.config.ts` |
| `frontend/shared/manual_riskFactorSummary.ts` | `utils/manual_riskFactorSummary.ts` |
| `frontend/shared/manual_downloadSuitabilityCsv.ts` | `utils/manual_downloadSuitabilityCsv.ts` |

All are completely new files — just drop them in. DO NOT touch your existing files.

---

## FAST_BACKEND

### STEP 3 — Add these files into their correct locations:

| File | Where to put it |
|---|---|
| `fast_backend/manual_stp_schema.py` | `app/api/schema/manual_stp_schema.py` |
| `fast_backend/manual_stp_routes.py` | `app/api/routes/manual_stp_routes.py` |
| `fast_backend/manual_stp_service.py` | `app/api/service/river_water_management/manual_stp_service.py` |

Then register the new router in your main app file:
```python
from app.api.routes.manual_stp_routes import router as manual_stp_router
app.include_router(manual_stp_router, prefix="/stp_operation", tags=["manual_stp"])
```

---

## ZERO RISK
- Every file is brand new with manual_ prefix — nothing overwrites existing files.
- Your existing admin/users/drain flows are completely untouched.
