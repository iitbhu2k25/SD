"use client";

import React, { useEffect, useState } from "react";
import LocationSelector from "./locations";

interface LocationItem {
  id: number;
  name: string;
}

interface District extends LocationItem {
  stateId: number;
}

interface SubDistrict extends LocationItem {
  districtId: number;
  districtName: string;
}

interface CalculatorProps {
  isDrawing: boolean;
  setIsDrawing: (value: boolean) => void;
  coordinates: number[][] | null;
  setCoordinates: (coords: number[][] | null) => void;
  setResetPolygon: (value: boolean) => void;
}

export default function Calculator({
  isDrawing,
  setIsDrawing,
  coordinates,
  setCoordinates,
  setResetPolygon,
}: CalculatorProps) {
  const [roofType, setRoofType] = useState("");
  const [roofSurface, setRoofSurface] = useState("");
  const [area, setArea] = useState("");
  const [rainfall, setRainfall] = useState("");
  const [areaUnit, setAreaUnit] = useState("km2");
  const [personCount, setPersonCount] = useState("5");
  const [waterDemand, setWaterDemand] = useState("20");
  const [volume, setVolume] = useState<number | null>(null);
  const [dryDays, setDryDays] = useState<number | null>(null);
  const [timeMode, setTimeMode] = useState<"annually" | "monthly">("annually");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCalculating, setIsCalculating] = useState(false);

  const handleCalculate = async () => {
    if (!validateForm()) return;

    setIsCalculating(true);

    await new Promise((resolve) => setTimeout(resolve, 500));

    const Cr = roofType === "slope" ? 0.95 : roofType === "flats" ? 0.8 : 0;
    let A = parseFloat(area);
    const R = parseFloat(rainfall);
    let Ce;
    const numPeople = parseFloat(personCount);
    const demandPerPerson = parseFloat(waterDemand);

    switch (roofSurface) {
      case "roof-conventional":
        Ce = 0.75;
        break;
      case "roof-inclined":
        Ce = 0.9;
        break;
      case "concrete-paving":
        Ce = 0.65;
        break;
      case "gravel":
        Ce = 0.6;
        break;
      case "brick":
        Ce = 0.7;
        break;
      default:
        Ce = 0.75;
        break;
    }

    if (!A || !R || !Cr) {
      setVolume(null);
      setDryDays(null);
      setIsCalculating(false);
      return;
    }

    if (areaUnit === "ft2") {
      A = A * 0.09290312990645;
    } else if (areaUnit === "km2") {
      A = A * 100000;
    }

    const V = A * R * Cr * Ce * 0.001;
    setVolume(V);

    if (numPeople && demandPerPerson) {
      const r = (V * 1000) / (numPeople * demandPerPerson);
      setDryDays(r);
    } else {
      setDryDays(null);
    }
    setIsCalculating(false);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!area || parseFloat(area) <= 0) {
      newErrors.area = "Please enter a valid area greater than 0";
    }
    if (!rainfall || parseFloat(rainfall) <= 0) {
      newErrors.rainfall = "Please enter valid rainfall data";
    }
    if (!roofType) {
      newErrors.roofType = "Please select a rooftop type";
    }
    if (!roofSurface) {
      newErrors.roofSurface = "Please select a roof surface type";
    }

    if (!personCount || parseFloat(personCount) <= 0) {
      newErrors.personCount = "Please enter valid person count";
    }
    if (!waterDemand || parseFloat(waterDemand) <= 0) {
      newErrors.waterDemand = "Please enter valid water demand";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // useEffect(() => {
  //   const fetchStates = async (): Promise<void> => {
  //     try {
  //       const response = await fetch("http://localhost:9000/api/basic/");
  //       if (!response.ok) {
  //         throw new Error(`HTTP error! Status: ${response.status}`);
  //       }
  //       const data = await response.json();
  //       const stateData: LocationItem[] = data.map((state: any) => ({
  //         id: state.state_code,
  //         name: state.state_name,
  //       }));
  //       setStates(stateData);
  //     } catch (error) {
  //       console.log("Error fetching states:", error);
  //     }
  //   };
  //   fetchStates();
  // }, []);

  // useEffect(() => {
  //   if (selectedState) {
  //     const fetchDistricts = async (): Promise<void> => {
  //       try {
  //         const response = await fetch(
  //           "http://localhost:9000/api/basic/district/",
  //           {
  //             method: "POST",
  //             headers: {
  //               "Content-Type": "application/json",
  //             },
  //             body: JSON.stringify({ state_code: selectedState }),
  //           }
  //         );
  //         const data = await response.json();
  //         const districtData: LocationItem[] = data.map((district: any) => ({
  //           id: district.district_code,
  //           name: district.district_name,
  //         }));
  //         const mappedDistricts: District[] = districtData.map((district) => ({
  //           ...district,
  //           stateId: parseInt(selectedState),
  //         }));
  //         const sortedDistricts = [...mappedDistricts].sort((a, b) =>
  //           a.name.localeCompare(b.name)
  //         );
  //         setDistricts(sortedDistricts);
  //       } catch (error) {
  //         console.log("Error fetching districts:", error);
  //       }
  //     };
  //     fetchDistricts();
  //   } else {
  //     setDistricts([]);
  //   }
  //   setSelectedDistrict("");
  //   setSelectedSubDistricts([]);
  // }, [selectedState]);

  // useEffect(() => {
  //   if (selectedDistrict) {
  //     const fetchSubDistricts = async (): Promise<void> => {
  //       try {
  //         const response = await fetch(
  //           "http://localhost:9000/api/basic/subdistrict/",
  //           {
  //             method: "POST",
  //             headers: {
  //               "Content-Type": "application/json",
  //             },
  //             body: JSON.stringify({ district_code: [selectedDistrict] }),
  //           }
  //         );
  //         const data = await response.json();
  //         const districtMap = new Map(
  //           districts.map((district) => [district.id.toString(), district.name])
  //         );
  //         const subDistrictData: SubDistrict[] = data.map(
  //           (subDistrict: any) => {
  //             const districtId = subDistrict.district_code.toString();
  //             return {
  //               id: subDistrict.subdistrict_code,
  //               name: subDistrict.subdistrict_name,
  //               districtId: subDistrict.district_code,
  //               districtName: districtMap.get(districtId) || "",
  //             };
  //           }
  //         );
  //         const sortedSubDistricts = subDistrictData.sort(
  //           (a, b) =>
  //             a.districtName.localeCompare(b.districtName) ||
  //             a.name.localeCompare(b.name)
  //         );
  //         setSubDistricts(sortedSubDistricts);
  //         setSelectedSubDistricts([]);
  //       } catch (error) {
  //         console.log("Error fetching sub-districts:", error);
  //       }
  //     };
  //     fetchSubDistricts();
  //   } else {
  //     setSubDistricts([]);
  //     setSelectedSubDistricts([]);
  //   }
  // }, [selectedDistrict]);

  const convertArea = (selectedUnit: string): void => {
    const areaInCurrentUnit = Number(area); // ensure area is treated as a number

    let convertedArea = areaInCurrentUnit;

    if (areaUnit === "km2") {
      if (selectedUnit === "m2") convertedArea = areaInCurrentUnit * 1_000_000;
      else if (selectedUnit === "ft2")
        convertedArea = areaInCurrentUnit * 10763900;
    } else if (areaUnit === "m2") {
      if (selectedUnit === "km2") convertedArea = areaInCurrentUnit / 1_000_000;
      else if (selectedUnit === "ft2")
        convertedArea = areaInCurrentUnit * 10.7639;
    } else if (areaUnit === "ft2") {
      if (selectedUnit === "km2")
        convertedArea = areaInCurrentUnit * 9.2903129906447 * 0.00000001;
      else if (selectedUnit === "m2")
        convertedArea = areaInCurrentUnit * 0.09290312990645;
    }

    setAreaUnit(selectedUnit);
    setArea(convertedArea.toFixed(2));
  };

  return (
      <div className="w-full max-w-6xl min-w-0">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 h-full overflow-auto">
          <div className="bg-gradient-to-r from-blue-600 to-green-600 p-4 sm:p-6 text-white">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-center flex items-center justify-center gap-2 sm:gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center">
                💧
              </div>
              Rainwater Harvesting Calculator
            </h1>
            <p className="text-center mt-2 text-blue-100">
              Calculate your rainwater collection potential and storage
              requirements
            </p>
          </div>
          <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 min-w-full w-full">
            <div className="bg-gray-50 rounded-xl p-6 border-2 border-gray-200 min-w-full w-full">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm">
                  1
                </span>
                Location & Climate Data
              </h2>
              <LocationSelector
                setRainfall={setRainfall}
                setArea={setArea}
                setAreaUnit={setAreaUnit}
                isDrawing={isDrawing}
                setIsDrawing={setIsDrawing}
                coordinates={coordinates}
                setCoordinates={setCoordinates}
                setResetPolygon={setResetPolygon}
                timeMode={timeMode}
                setTimeMode={setTimeMode}
              />
            </div>
            {/* Area and Rainfall Inputs */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm">
                  2
                </span>
                Area & Rainfall Parameters
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Catchment Area
                  </label>
                  <div className="flex rounded-lg overflow-hidden border border-gray-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                    <input
                      type="number"
                      value={area}
                      onChange={(e) => {
                        setArea(e.target.value);
                        if (errors.area) {
                          const newErrors = { ...errors };
                          delete newErrors.area;
                          setErrors(newErrors);
                        }
                      }}
                      className={`flex-1 p-3 border-0 focus:outline-none ${
                        errors.area ? "bg-red-50" : "bg-white"
                      }`}
                      placeholder="Enter catchment area"
                      min={0}
                      step="0.01"
                    />
                    <select
                      value={areaUnit}
                      onChange={(e) => convertArea(e.target.value)}
                      className="px-4 py-3 bg-gray-100 border-0 focus:outline-none cursor-pointer"
                    >
                      <option value="km2">km²</option>
                      <option value="m2">m²</option>
                      <option value="ft2">ft²</option>
                    </select>
                  </div>
                  {errors.area && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <span>⚠</span> {errors.area}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Rainfall per {timeMode === "monthly" ? "month" : "year"}{" "}
                    (mm)
                  </label>
                  <input
                    type="number"
                    value={rainfall}
                    onChange={(e) => {
                      setRainfall(e.target.value);
                      if (errors.rainfall) {
                        const newErrors = { ...errors };
                        delete newErrors.rainfall;
                        setErrors(newErrors);
                      }
                    }}
                    className={`w-full p-2 sm:p-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors ${
                      errors.rainfall ? "border-red-300 bg-red-50" : ""
                    }`}
                    placeholder="Enter rainfall data"
                    min={0}
                    step="0.1"
                  />
                  {errors.rainfall && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <span>⚠</span> {errors.rainfall}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Roof Parameters */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm">
                  3
                </span>
                Roof Specifications
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Rooftop Type
                  </label>
                  <select
                    value={roofType}
                    onChange={(e) => {
                      setRoofType(e.target.value);
                      if (errors.roofType) {
                        const newErrors = { ...errors };
                        delete newErrors.roofType;
                        setErrors(newErrors);
                      }
                    }}
                    className={`w-full p-2 sm:p-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer transition-colors ${
                      errors.roofType ? "border-red-300 bg-red-50" : "bg-white"
                    }`}
                  >
                    <option value="">Select Rooftop Type</option>
                    <option value="slope">Sloped Roof (Runoff: 95%)</option>
                    <option value="flats">Flat Roof (Runoff: 80%)</option>
                  </select>
                  {errors.roofType && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <span>⚠</span> {errors.roofType}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Roof Surface Material
                  </label>
                  <select
                    value={roofSurface}
                    onChange={(e) => {
                      setRoofSurface(e.target.value);
                      if (errors.roofSurface) {
                        const newErrors = { ...errors };
                        delete newErrors.roofSurface;
                        setErrors(newErrors);
                      }
                    }}
                    className={`w-full p-2 sm:p-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer transition-colors ${
                      errors.roofSurface
                        ? "border-red-300 bg-red-50"
                        : "bg-white"
                    }`}
                  >
                    <option value="">Select Surface Material</option>
                    <option value="roof-conventional">
                      Conventional Tiles (Efficiency: 75%)
                    </option>
                    <option value="roof-inclined">
                      Metal/Inclined Roof (Efficiency: 90%)
                    </option>
                    <option value="concrete-paving">
                      Concrete/Paving (Efficiency: 65%)
                    </option>
                    <option value="gravel">
                      Gravel Surface (Efficiency: 60%)
                    </option>
                    <option value="brick">
                      Brick Paving (Efficiency: 70%)
                    </option>
                  </select>
                  {errors.roofSurface && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <span>⚠</span> {errors.roofSurface}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm">
                  4
                </span>
                Water Demand Requirements
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Household Users
                  </label>
                  <select
                    value={personCount}
                    onChange={(e) => setPersonCount(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer bg-white"
                  >
                    <option value="5">5 persons</option>
                    <option value="5.5">5.5 persons</option>
                    <option value="6">6 persons</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Per Person Water Demand (L/day)
                  </label>
                  <input
                    type="number"
                    value={waterDemand}
                    onChange={(e) => setWaterDemand(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors bg-white"
                    min={1}
                    placeholder="Daily water requirement per person"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Typical household consumption: 15-25 L/person/day
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
              <button
                onClick={handleCalculate}
                disabled={isCalculating}
                className={`flex-1 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 text-sm sm:text-base rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                  isCalculating
                    ? "bg-gray-400 text-white cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                }`}
              >
                {isCalculating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Calculating...
                  </>
                ) : (
                  <>
                    Calculate Rainwater Potential
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setArea("");
                  setRainfall("");
                  setVolume(null);
                  setDryDays(null);
                  setRoofType("");
                  setRoofSurface("");
                  setPersonCount("5");
                  setWaterDemand("20");
                  setTimeMode("annually");
                  setErrors({});
                  setCoordinates(null);
                }}
                disabled={isCalculating}
                className="flex-1 px-8 py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
              >
                Reset All Fields
              </button>
            </div>

            {/* {volume !== null && (
            <div className="space-y-2 text-center">
              <div className="text-xl font-semibold text-green-700">
                The Volume is {volume.toFixed(1)} m³ (
                {(volume * 1000).toFixed(0)} L)
              </div>
              {dryDays !== null && (
                <div className="text-md font-medium text-indigo-700">
                  Supply for estimated dry days = {dryDays.toFixed(1)} days
                </div>
              )}
            </div>
          )} */}
            {/* Results Display */}
            {volume !== null && (
              <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 border-2 border-green-200 mt-8">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm">
                    ✓
                  </span>
                  Calculation Results
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="bg-white rounded-lg p-4 sm:p-6 shadow-md">
                    <div className="text-center">
                      <div className="text-4xl mb-2">💧</div>
                      <div className="text-xl sm:text-2xl font-bold text-green-700 mb-2">
                        {volume.toFixed(1)} m³
                      </div>
                      <div className="text-base sm:text-lg text-gray-600 mb-1">
                        ({(volume * 1000).toFixed(0)} Liters)
                      </div>
                      <div className="text-sm text-gray-500">
                        Total Collectable Volume
                      </div>
                    </div>
                  </div>
                  {dryDays !== null && (
                    <div className="bg-white rounded-lg p-4 sm:p-6 shadow-md">
                      <div className="text-center">
                        <div className="text-4xl mb-2">📅</div>
                        <div className="text-2xl font-bold text-indigo-700 mb-2">
                          {dryDays.toFixed(1)} days
                        </div>
                        <div className="text-sm text-gray-500">
                          Water Supply Duration
                        </div>
                        <div className="text-xs text-gray-400 mt-2">
                          Based on {personCount} users × {waterDemand}L/day
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    
  );
}
