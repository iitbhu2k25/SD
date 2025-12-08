from fastapi import APIRouter, HTTPException, Request, Form
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union
import json
import base64
import os
import gzip
import io

from app.services.gsr_service import (
    match_village_data_combined,
    merge_gsr_with_shapefile,
    generate_gsr_map_image,
    calculate_gsr_summary,
    load_village_shapefile,
)

router = APIRouter()

@router.post("/gsr")
async def compute_gsr(request: Request):
    """
    Compute GSR (Groundwater Supply-Requirement) analysis with geospatial data
    Receives combined demand data (domestic + agricultural + industrial already aggregated)
    """
    try:
        # Handle different content types
        content_type = request.headers.get("content-type", "")
        
        if "application/json" in content_type:
            body = await request.json()
            
            # Check if data is zipped
            if "zipped_data" in body:
                # Decode base64 and decompress gzip
                compressed_bytes = base64.b64decode(body["zipped_data"])
                with gzip.GzipFile(fileobj=io.BytesIO(compressed_bytes)) as gz:
                    json_data = gz.read().decode('utf-8')
                    data = json.loads(json_data)
            else:
                data = body
                
        elif "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
            form_data = await request.form()
            data = dict(form_data)
        else:
            # Try to parse as JSON anyway
            data = await request.json()
        
        # Log received data for debugging
        print("\n" + "=" * 80)
        print("📥 GSR API - RECEIVED DATA (COMBINED DEMAND)")
        print("=" * 80)
        print(f"Content-Type: {content_type}")
        print(f"Data type: {type(data)}")
        print(f"Data keys: {list(data.keys())}")
        
        # Parse JSON strings if needed
        for key in ["rechargeData", "combinedDemandData", "selectedSubDistricts"]:
            if key in data and isinstance(data.get(key), str):
                try:
                    data[key] = json.loads(data[key])
                except json.JSONDecodeError:
                    data[key] = []
        
        # Extract data arrays
        recharge_data = data.get('rechargeData', [])
        combined_demand_data = data.get('combinedDemandData', [])
        selected_subdistricts = data.get('selectedSubDistricts', [])
        trend_csv_filename = data.get('trendCsvFilename')
        
        # ========================================================================
        # ENHANCED LOGGING: Print received data tables
        # ========================================================================
        print("\n📊 RECHARGE DATA TABLE:")
        print(f"   Total records: {len(recharge_data)}")
        if recharge_data:
            print(f"   Sample (first 3 records):")
            for idx, item in enumerate(recharge_data[:3], 1):
                print(f"   {idx}. Village: {item.get('village_co', 'N/A')}, "
                      f"Recharge: {item.get('recharge', 0)} MCM")
        else:
            print("   ⚠️ No recharge data received")
        
        print("\n🏭 COMBINED DEMAND DATA TABLE (Pre-Aggregated):")
        print(f"   Total records: {len(combined_demand_data)}")
        if combined_demand_data:
            print(f"   Sample (first 3 records):")
            for idx, item in enumerate(combined_demand_data[:3], 1):
                print(f"   {idx}. Village: {item.get('village_name', 'N/A')} (Code: {item.get('village_code', 'N/A')})")
                print(f"      - Domestic: {item.get('domestic_demand', 0)} MLD")
                print(f"      - Agricultural: {item.get('agricultural_demand', 0)} MLD")
                print(f"      - Industrial: {item.get('industrial_demand', 0)} MLD")
                print(f"      - TOTAL (Pre-calculated): {item.get('total_demand', 0)} MLD")
            
            # Calculate total demand across all villages
            total_demand_all = sum(float(item.get('total_demand', 0)) for item in combined_demand_data)
            total_domestic_all = sum(float(item.get('domestic_demand', 0)) for item in combined_demand_data)
            total_agricultural_all = sum(float(item.get('agricultural_demand', 0)) for item in combined_demand_data)
            total_industrial_all = sum(float(item.get('industrial_demand', 0)) for item in combined_demand_data)
            
            print(f"\n   📈 AGGREGATE TOTALS:")
            print(f"      Domestic: {total_domestic_all:.3f} MLD")
            print(f"      Agricultural: {total_agricultural_all:.3f} MLD")
            print(f"      Industrial: {total_industrial_all:.3f} MLD")
            print(f"      ─────────────────────────────────────────────")
            print(f"      TOTAL DEMAND: {total_demand_all:.3f} MLD")
            print(f"   ✅ Using pre-calculated total_demand from frontend (no recalculation needed)")
        else:
            print("   ⚠️ No combined demand data received")
        
        print("\n📍 SELECTED SUBDISTRICTS:")
        print(f"   Total: {len(selected_subdistricts)}")
        print(f"   Codes: {selected_subdistricts}")
        
        print("\n📈 TREND DATA:")
        if trend_csv_filename:
            print(f"   CSV Filename: {trend_csv_filename}")
        else:
            print("   ⚠️ No trend CSV filename provided")
        
        print("\n🎯 DATA FLAGS:")
        print(f"   Has Recharge Data: {data.get('hasRechargeData', False)}")
        print(f"   Has Demand Data (Combined): {data.get('hasDemandData', False)}")
        print("=" * 80 + "\n")
        
        # Validation
        if not recharge_data:
            return {
                "success": False,
                "error": "Recharge data is required for GSR analysis"
            }
        
        if not combined_demand_data:
            return {
                "success": False,
                "error": "Combined demand data is required for GSR analysis"
            }
        
        # Match village data using combined demand
        print("🔄 Matching village data between recharge and combined demand datasets...")
        matched_results = match_village_data_combined(
            recharge_data, 
            combined_demand_data,
            trend_csv_filename
        )
        
        if not matched_results:
            return {
                "success": False,
                "error": "No villages could be matched across the provided datasets"
            }
        
        print(f"✅ Successfully matched {len(matched_results)} villages")
        
        # Sort results by classification priority
        classification_priority = {
            "Over Exploited": 1,
            "Critical": 2,
            "Very Semi-Critical": 3,
            "Safe": 4,
            "Very Safe": 5,
            "Unknown Status": 6,
            "No Data": 7
        }
        
        matched_results.sort(key=lambda x: (
            classification_priority.get(x['gsr_classification'], 999),
            -(x['gsr'] or 0)
        ))
        
        # Calculate summary statistics
        summary = calculate_gsr_summary(matched_results)
        
        # Print summary with demand breakdown
        print("\n📊 GSR CALCULATION SUMMARY:")
        print(f"   Total Recharge: {summary.get('total_recharge', 0)} MCM")
        print(f"   Total Domestic Demand: {summary.get('total_domestic_demand', 0)} MCM")
        print(f"   Total Agricultural Demand: {summary.get('total_agricultural_demand', 0)} MCM")
        print(f"   Total Industrial Demand: {summary.get('total_industrial_demand', 0)} MCM")
        print(f"   ─────────────────────────────────────────────")
        print(f"   TOTAL DEMAND (D+A+I): {summary.get('total_demand', 0)} MCM")
        print(f"   OVERALL GSR: {summary.get('overall_gsr', 0)}")
        print(f"   Average GSR: {summary.get('average_gsr', 0)}")
        print(f"   Sustainable Villages: {summary.get('sustainable_villages', 0)}")
        print(f"   Stressed Villages: {summary.get('stressed_villages', 0)}")
        
        # Load village shapefile and merge with GSR data
        village_gdf = load_village_shapefile()
        geospatial_result = None
        map_image_filename = None
        map_image_base64 = None
        
        if village_gdf is not None:
            print("\n🗺️ Merging GSR data with village shapefile...")
            geospatial_result = merge_gsr_with_shapefile(matched_results, village_gdf)
            
            # Generate map image if merge was successful
            if geospatial_result.get('merged_gdf') is not None:
                print("🎨 Generating GSR map image...")
                map_image_filename = generate_gsr_map_image(geospatial_result['merged_gdf'])
                
                if map_image_filename:
                    map_image_path = os.path.join("media", "temp", map_image_filename)
                    try:
                        with open(map_image_path, "rb") as img_file:
                            map_image_base64 = base64.b64encode(img_file.read()).decode("utf-8")
                        print(f"✅ Map image encoded to base64 successfully")
                    except Exception as e:
                        print(f"❌ Error encoding map image to base64: {str(e)}")
        else:
            print("⚠️ Could not load village shapefile - proceeding without geospatial data")
            geospatial_result = {
                'geojson': None,
                'merge_statistics': {
                    'error': 'Village shapefile not found or could not be loaded',
                    'total_shapefile_villages': 0,
                    'total_gsr_villages': len(matched_results),
                    'villages_with_geospatial_data': 0,
                    'villages_without_geospatial_data': len(matched_results),
                    'match_success_rate': 0
                }
            }
        
        # Debug logging - Show sample result with all demand components
        if matched_results:
            sample_result = matched_results[0]
            print(f"\n📋 SAMPLE RESULT (First Village):")
            print(f"   Village Code: {sample_result.get('village_code', 'N/A')}")
            print(f"   Village Name: {sample_result.get('village_name', 'N/A')}")
            print(f"   Recharge: {sample_result['recharge']} MCM")
            print(f"   Domestic Demand: {sample_result['domestic_demand']} MCM")
            print(f"   Agricultural Demand: {sample_result['agricultural_demand']} MCM")
            print(f"   Industrial Demand: {sample_result['industrial_demand']} MCM")
            print(f"   ─────────────────────────────────────────────")
            print(f"   TOTAL DEMAND (from frontend): {sample_result['total_demand']} MCM")
            print(f"   GSR Ratio: {sample_result['gsr']}")
            print(f"   GSR Status: {sample_result['gsr_status']}")
            print(f"   Trend Status: {sample_result['trend_status']}")
            print(f"   Classification: {sample_result['gsr_classification']}")
            print(f"   Color: {sample_result['classification_color']}")
        
        # Additional metadata
        import pandas as pd
        metadata = {
            'computation_timestamp': pd.Timestamp.now().isoformat(),
            'input_datasets': {
                'recharge_villages': len(recharge_data),
                'combined_demand_villages': len(combined_demand_data)
            },
            'selected_subdistricts': selected_subdistricts,
            'trend_csv_filename': trend_csv_filename,
            'map_image_filename': map_image_filename,
            'flags': {
                'has_recharge_data': data.get('hasRechargeData', False),
                'has_demand_data': data.get('hasDemandData', False),
                'has_trend_data': trend_csv_filename is not None,
                'has_geospatial_data': geospatial_result['geojson'] is not None,
                'has_map_image': map_image_filename is not None
            },
            'notes': 'Using pre-aggregated combined demand data (domestic + agricultural + industrial)'
        }
        
        # Response matching Django structure exactly
        response_data = {
            "success": True,
            "message": f"GSR analysis completed successfully for {len(matched_results)} villages (using combined demand data)",
            "data": matched_results,
            "summary": summary,
            "metadata": metadata,
            "villages_count": len(matched_results),
            "geospatial_data": geospatial_result['geojson'],
            "merge_statistics": geospatial_result['merge_statistics'],
            "map_image_filename": map_image_filename,
            "map_image_base64": f"data:image/png;base64,{map_image_base64}" if map_image_base64 else None
        }
        
        print(f"\n✅ GSR computation completed successfully!")
        print(f"📤 Sending response with {len(matched_results)} village results\n")
        print("=" * 80 + "\n")
        
        return response_data
        
    except Exception as e:
        print(f"\n❌ ERROR in compute_gsr: {str(e)}")
        import traceback
        traceback.print_exc()
        print("=" * 80 + "\n")
        
        return {
            "success": False,
            "error": f"Internal server error during GSR computation: {str(e)}"
        }

@router.get("/gsr")
async def gsr_health_check():
    """
    GET endpoint for API documentation/health check
    """
    return {
        "service": "GSR Computation API with Combined Demand Data",
        "version": "3.0",
        "description": "Computes GSR analysis using pre-aggregated combined demand data from frontend",
        "expected_payload": {
            "rechargeData": "Array of recharge data with 'village_co' and 'recharge' fields",
            "combinedDemandData": "Array of combined demand data with pre-calculated domestic, agricultural, industrial, and total_demand fields", 
            "selectedSubDistricts": "Array of selected subdistrict codes",
            "trendCsvFilename": "Optional filename of trend CSV (stored in media/temp/) with Village_ID field",
            "hasRechargeData": "Boolean flag",
            "hasDemandData": "Boolean flag for combined demand data"
        },
        "response_format": {
            "success": "Boolean",
            "data": "Array of village GSR results with trend_status, gsr_classification and classification_color fields",
            "summary": "Summary statistics including trend and classification distribution",
            "metadata": "Additional computation metadata including map_image_filename",
            "geospatial_data": "GeoJSON FeatureCollection with village polygons and GSR data merged",
            "merge_statistics": "Statistics about shapefile-GSR data merge success",
            "map_image_filename": "Filename of generated map image saved in media/temp/",
            "map_image_base64": "Base64 encoded map image string"
        },
        "demand_calculation": {
            "note": "Total demand is pre-calculated on frontend and included in combinedDemandData",
            "formula": "Total Demand = Domestic + Agricultural + Industrial (calculated in frontend)",
            "gsr_formula": "GSR = Total Recharge / Total Demand",
            "components": {
                "domestic": "Water demand from domestic/residential use",
                "agricultural": "Water demand from crop irrigation",
                "industrial": "Water demand from industrial facilities",
                "total": "Pre-aggregated total from frontend (no recalculation needed)"
            }
        },
        "classifications": {
            "Critical": {
                "description": "GSR < 0.95 with Increasing trend OR GSR 0.95-1.05 with Decreasing trend",
                "color": "red"
            },
            "Safe": {
                "description": "GSR 0.95-1.05 with Increasing/No trend",
                "color": "green"
            },
            "Very Safe": {
                "description": "GSR > 1.05 with Increasing/No trend",
                "color": "teal"
            },
            "Over Exploited": {
                "description": "GSR < 0.95 with Decreasing/No trend",
                "color": "darkred"
            },
            "Very Semi-Critical": {
                "description": "GSR > 1.05 with Decreasing trend",
                "color": "orange"
            },
            "Unknown Status": {
                "description": "Unknown trend status",
                "color": "gray"
            },
            "No Data": {
                "description": "Missing GSR data",
                "color": "gold"
            }
        }
    }