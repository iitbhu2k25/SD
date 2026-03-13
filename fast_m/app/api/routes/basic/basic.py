from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.api.schema.basic_schema import (
    CohortRequest,
    DemographicRequest,
    DistrictRequest,
    DomesticWaterDemandRequest,
    DrainNoRequest,
    FirefightingWaterDemandRequest,
    FloatingWaterDemandRequest,
    IdListRequest,
    InstitutionalWaterDemandRequest,
    PeakSewageFlowRequest,
    RawSewageCharacteristicsRequest,
    RiverCodeRequest,
    SewageRequest,
    StormwaterRunoffRequest,
    StretchIdRequest,
    StudyAreaMapRequest,
    SubdistrictRequest,
    TimeSeriesRequest,
    VillageCodesRequest,
    VillageRequest,
    WaterSupplyRequest,
)
from app.api.service.basic.basic_service import BasicService
from app.database.config.dependency import db_dependency

router = APIRouter()


@router.get("/state")
def states(db: db_dependency):
    return BasicService(db).get_states()


@router.post("/district")
def districts(payload: DistrictRequest, db: db_dependency):
    return BasicService(db).get_districts(payload.state_code)


@router.post("/subdistrict")
def subdistricts(payload: SubdistrictRequest, db: db_dependency):
    district_codes = payload.district_code if isinstance(payload.district_code, list) else [payload.district_code]
    return BasicService(db).get_subdistricts([int(x) for x in district_codes])


@router.post("/village")
def villages(payload: VillageRequest, db: db_dependency):
    subdistrict_codes = payload.subdistrict_code if isinstance(payload.subdistrict_code, list) else [payload.subdistrict_code]
    return BasicService(db).get_villages([int(x) for x in subdistrict_codes])


@router.post("/time_series/arthemitic")
def time_series(payload: TimeSeriesRequest, db: db_dependency):
    try:
        return BasicService(db).time_series(payload.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/time_series/demographic")
def demographic(payload: DemographicRequest, db: db_dependency):
    try:
        result = BasicService(db).demographic(payload.model_dump())
        print("demographic API result:", result)
        return result
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/sewage_calculation")
@router.post("/sewage_calculation/total_population")
def sewage_calculation(payload: SewageRequest, db: db_dependency):
    try:
        return BasicService(db).sewage_calculation(payload.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/peak_sewage_flow")
def peak_sewage_flow(payload: PeakSewageFlowRequest, db: db_dependency):
    try:
        return BasicService(db).peak_sewage_flow(payload.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/raw_sewage_characteristics")
def raw_sewage_characteristics(payload: RawSewageCharacteristicsRequest, db: db_dependency):
    try:
        return BasicService(db).raw_sewage_characteristics(payload.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc




@router.post("/water_supply")
def water_supply(payload: WaterSupplyRequest, db: db_dependency):
    try:
        return BasicService(db).water_supply(payload.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/domestic_water_demand")
def domestic_water_demand(payload: DomesticWaterDemandRequest, db: db_dependency):
    try:
        return BasicService(db).domestic_water_demand(payload.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/floating_water_demand")
def floating_water_demand(payload: FloatingWaterDemandRequest, db: db_dependency):
    try:
        return BasicService(db).floating_water_demand(payload.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/institutional_water_demand")
def institutional_water_demand(payload: InstitutionalWaterDemandRequest, db: db_dependency):
    try:
        return BasicService(db).institutional_water_demand(payload.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/firefighting_water_demand")
def firefighting_water_demand(payload: FirefightingWaterDemandRequest, db: db_dependency):
    try:
        return BasicService(db).firefighting_water_demand(payload.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/cohort")
def cohort(payload: CohortRequest, db: db_dependency):
    try:
        return BasicService(db).cohort(payload.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/rivers")
def rivers(db: db_dependency):
    try:
        return BasicService(db).rivers()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.post("/river-stretched")
def river_stretched(payload: RiverCodeRequest, db: db_dependency):
    try:
        return BasicService(db).river_stretched(payload.River_Code)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.post("/drain")
def drain(payload: StretchIdRequest, db: db_dependency):
    try:
        return BasicService(db).drain(payload.Stretch_ID)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.get("/basin")
def basin(db: db_dependency):
    try:
        return BasicService(db).basin()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.post("/catchment")
def catchment(payload: DrainNoRequest, db: db_dependency):
    try:
        return BasicService(db).catchment(payload.Drain_No)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.get("/all-stretches")
def all_stretches(db: db_dependency):
    try:
        return BasicService(db).all_stretches()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.post("/catchment_village")
def catchment_village(payload: DrainNoRequest, db: db_dependency):
    try:
        return BasicService(db).catchment_village(payload.Drain_No)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.post("/village-population")
def village_population(payload: IdListRequest, db: db_dependency):
    try:
        return BasicService(db).village_population(payload.shapeID)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.post("/village-population-raw")
def village_population_raw(payload: IdListRequest, db: db_dependency):
    try:
        return BasicService(db).village_population_raw(payload.shapeID)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.get("/swrunoff")
def swrunoff_get(db: db_dependency):
    service = BasicService(db)
    durations = service.crud.get_runoff_durations()
    return {
        "duration_values": durations,
        "total_count": len(durations),
        "description": "Available duration values in minutes for runoff analysis",
    }


@router.post("/swrunoff")
def swrunoff_post(payload: VillageCodesRequest, db: db_dependency):
    try:
        return BasicService(db).swrunoff(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.post("/stormwaterrunoff")
def stormwater_runoff(payload: StormwaterRunoffRequest, db: db_dependency):
    try:
        return BasicService(db).stormwater_runoff(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.post("/pdf", status_code=status.HTTP_201_CREATED)
def pdf_to_temp(db: db_dependency, pdf_file: UploadFile = File(...)):
    try:
        return BasicService(db).save_pdf_to_temp(pdf_file)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.post("/studyareamap")
def study_area_map(payload: StudyAreaMapRequest, db: db_dependency):
    try:
        return BasicService(db).study_area_map(payload.village_codes)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.post("/village-intersection")
def village_intersection(payload: dict, db: db_dependency):
    try:
        return BasicService(db).village_intersection(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
