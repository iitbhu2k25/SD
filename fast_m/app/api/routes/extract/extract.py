from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.api.schema.extract.extract_schema import HGStationDataRequest, WaterLevelRequest
from app.api.service.extract.extract_service import ExtractService

router = APIRouter()
service = ExtractService()


@router.get("/state/rainfall/daily")
def state_rainfall_daily():
    return service.state_rainfall("D")


@router.get("/state/rainfall/weekly")
def state_rainfall_weekly():
    return service.state_rainfall("W")


@router.get("/state/rainfall/monthly")
def state_rainfall_monthly():
    return service.state_rainfall("M")


@router.get("/state/rainfall/cumulative")
def state_rainfall_cumulative():
    return service.state_rainfall("C")


@router.get("/district/rainfall/daily")
def district_rainfall_daily():
    return service.district_rainfall("D")


@router.get("/district/rainfall/weekly")
def district_rainfall_weekly():
    return service.district_rainfall("W")


@router.get("/district/rainfall/monthly")
def district_rainfall_monthly():
    return service.district_rainfall("M")


@router.get("/district/rainfall/cumulative")
def district_rainfall_cumulative():
    return service.district_rainfall("C")


@router.get("/rainfall_stats/statewise")
def rainfall_stats_statewise():
    data, content_type = service.statewise_distribution()
    return Response(content=data, media_type=content_type)


@router.get("/rainfall_stats/statewiseDC")
def rainfall_stats_statewise_dc():
    data, content_type = service.statewise_distribution_dc()
    return Response(content=data, media_type=content_type)


@router.get("/rainfall_stats/district/weekcumm")
def rainfall_stats_district_weekcumm():
    data, filename = service.district_week_cummulative_stats()
    return Response(content=data, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/rainfall_stats/district/weekly")
def rainfall_stats_district_weekly():
    data, filename = service.district_weekly_stats()
    return Response(content=data, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/rainfall_stats/district/D&C")
def rainfall_stats_district_daily_cumm():
    data, filename = service.district_daily_cumm_stats()
    return Response(content=data, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/rainfall/riverbasin/day1")
def river_basin_day1():
    return service.river_basin("Day1")


@router.get("/rainfall/riverbasin/day2")
def river_basin_day2():
    return service.river_basin("Day2")


@router.get("/rainfall/riverbasin/day3")
def river_basin_day3():
    return service.river_basin("Day3")


@router.get("/rainfall/riverbasin/day4")
def river_basin_day4():
    return service.river_basin("Day4")


@router.get("/rainfall/riverbasin/day5")
def river_basin_day5():
    return service.river_basin("Day5")


@router.get("/rainfall/riverbasin/day6")
def river_basin_day6():
    return service.river_basin("Day6")


@router.get("/rainfall/riverbasin/day7")
def river_basin_day7():
    return service.river_basin("Day7")


@router.get("/rainfall/riverbasin/aap")
def river_basin_aap():
    return service.river_basin("AAP")


@router.post("/water-level")
def water_level(payload: WaterLevelRequest):
    try:
        return service.water_level(payload.station_code)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch data: {str(exc)}") from exc


@router.post("/level")
def hg_station_data(payload: HGStationDataRequest):
    data, code = service.hg_station_data(payload.stationCode, payload.startDate, payload.endDate)
    if code >= 400:
        raise HTTPException(status_code=code, detail=data)
    return data
