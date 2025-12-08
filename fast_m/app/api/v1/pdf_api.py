from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from app.services.pdf_service import PDFMapService

router = APIRouter()


@router.post("/pdf")
async def generate_pdf(request: Request):

    # Read raw request body exactly like Django
    body = await request.json()

    # Accept BOTH camelCase and snake_case keys
    selected_sub_districts = body.get("selectedSubDistricts") or body.get("selected_sub_districts") or []
    selected_villages = body.get("village_codes") or []

    # Accept BOTH csvFilename and csv_filename
    csv_filename = body.get("csv_filename") or body.get("csvFilename")

    # Validation exactly like Django
    if not selected_sub_districts and not selected_villages:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": "Either selectedSubDistricts or village_codes is required"
            }
        )

    try:
        result = PDFMapService.generate_map(
            selected_sub_districts=selected_sub_districts,
            selected_villages=selected_villages,
            csv_filename=csv_filename
        )

        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "Map generated successfully",
                "data": result
            }
        )

    except FileNotFoundError as e:
        return JSONResponse(
            status_code=404,
            content={"success": False, "error": str(e)}
        )

    except ValueError as e:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": str(e)}
        )

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": f"Internal server error: {str(e)}"}
        )
