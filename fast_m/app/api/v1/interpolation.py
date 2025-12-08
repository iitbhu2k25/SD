# fast_m/app/api/v1/interpolation.py
from fastapi import APIRouter, HTTPException, status, Request
from typing import Optional, List, Any, Dict
from pathlib import Path
import traceback

from app.services.interpolation_service import InterpolationService, TEMP_DIR
from app.core.config import settings

router = APIRouter()
interpolation_service = InterpolationService()


@router.post(
    "/interpolation",
    status_code=status.HTTP_200_OK,
    summary="Generate interpolated raster (Django-compatible)",
    description="Create interpolated raster from point data using IDW, Kriging, or Spline methods"
)
async def interpolate_raster(request: Request):
    """
    Generate interpolated raster from CSV point data.
    
    This endpoint is fully compatible with the Django frontend.
    Accepts raw JSON body exactly like Django REST framework.
    
    Expected JSON body:
    {
        "method": "idw",
        "parameter": "gwl",
        "village_ids": [123, 456],
        "place": "village" or "subdistrict",
        "csv_file": "sample_data.csv",
        "create_colored": true,
        "generate_contours": true,
        "contour_interval": 5.0,
        "search_mode": "variable",
        "n_neighbors": 12,
        "radius": null,
        "power": 2.0,
        "cell_size": 30.0
    }
    """
    
    print(f"[DEBUG] POST request received")
    print(f"[DEBUG] Using GeoServer URL: http://geoserver:8080/geoserver/rest")
    
    try:
        # Parse JSON body exactly like Django's request.data
        data = await request.json()
        
        # Extract parameters from request body (matching Django exactly)
        method = data.get('method')
        parameter = data.get('parameter')
        village_ids = data.get('village_ids')
        place = data.get('place')
        csv_file = data.get('csv_file')
        create_colored = data.get('create_colored', True)
        contour_interval = data.get('contour_interval', None)
        generate_contours = data.get('generate_contours', False)
        
        # IDW parameters with defaults
        search_mode = data.get('search_mode', 'variable')
        n_neighbors = int(data.get('n_neighbors', 12))
        radius = data.get('radius', None)
        power = float(data.get('power', 2.0))
        cell_size = float(data.get('cell_size', 30.0))
        
        # Convert radius if provided
        if radius is not None:
            try:
                radius = float(radius)
            except:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail='radius must be numeric (meters)'
                )
        
        print(f"[DEBUG] Contour generation: {generate_contours}")
        if generate_contours and contour_interval:
            print(f"[DEBUG] Contour interval: {contour_interval} meters")
        
        # Validate required fields
        if not all([method, parameter, csv_file]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Missing required fields: method, parameter, csv_file'
            )
        
        # Validate contour interval
        if generate_contours and contour_interval is not None:
            try:
                contour_interval = float(contour_interval)
                if contour_interval <= 0:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail='Contour interval must be a positive number'
                    )
            except (ValueError, TypeError):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail='Invalid contour interval format'
                )
        
        # Validate method
        if method not in ['idw', 'kriging', 'spline']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Invalid interpolation method. Must be idw, kriging, or spline'
            )
        
        # Validate place and village_ids
        if not village_ids or not place:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='village_ids and place parameters are required'
            )
        
        if place not in ['village', 'subdistrict']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Invalid place parameter. Must be village or subdistrict'
            )
        
        if not isinstance(village_ids, list):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='village_ids parameter must be a list of IDs'
            )
        
        # Validate IDW parameters
        if method == 'idw':
            if search_mode not in ['variable', 'fixed']:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="IDW search_mode must be 'variable' or 'fixed'"
                )
            
            if search_mode == 'fixed' and (radius is None or radius <= 0):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Fixed search mode requires a positive radius value"
                )
        
        # Check CSV file exists
        csv_path = TEMP_DIR / csv_file
        print(f"[DEBUG] Looking for CSV at: {csv_path}")
        
        if not csv_path.exists():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"CSV file not found: {csv_path}"
            )
        
        print(f"[DEBUG] Received interpolation request for parameter: {parameter}")
        print(f"[DEBUG] Method: {method}, Place: {place}")
        
        # Process interpolation using service
        result = interpolation_service.process_interpolation(
            csv_path=csv_path,
            parameter=parameter,
            method=method,
            village_ids=village_ids,
            place=place,
            create_colored=create_colored,
            contour_interval=contour_interval,
            generate_contours=generate_contours,
            search_mode=search_mode,
            n_neighbors=n_neighbors,
            radius=radius,
            power=power,
            cell_size=cell_size
        )
        
        print(f"[✓] Interpolation completed successfully")
        print(f"[✓] Published layers: {result['published_layers']}")
        
        # Return response exactly like Django
        return result
    
    except HTTPException:
        raise
    
    except ValueError as ve:
        print(f"[ERROR] Validation error: {str(ve)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    
    except FileNotFoundError as fe:
        print(f"[ERROR] File not found: {str(fe)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Required file not found: {str(fe)}"
        )
    
    except Exception as e:
        print(f"[ERROR] Unexpected error in interpolation: {str(e)}")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating or publishing raster: {str(e)}"
        )