from fastapi import APIRouter, HTTPException, Request
from app.services.admin_unit_service import fetch_admin_units_from_villages

router = APIRouter()


@router.post("/adminunit")
async def get_admin_units(request: Request):
    body = await request.json()
    print("📥 Incoming request body:", body)

    village_codes = body.get("village_codes")

    if not village_codes:
        raise HTTPException(
            status_code=400,
            detail="village_codes is required"
        )

    try:
        result = fetch_admin_units_from_villages(village_codes)

        if result["state_code"] is None:
            raise HTTPException(
                status_code=404,
                detail="No admin units found for given villages"
            )

        return result

    except FileNotFoundError as e:
        print("❌ FILE ERROR:", e)
        raise HTTPException(status_code=500, detail=str(e))

    except Exception as e:
        print("❌ UNKNOWN ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail=f"Internal error: {str(e)}"
        )
