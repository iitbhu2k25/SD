//frontend\app\dss\basic\populations\population.tsx
//newly population 
'use client'
import React, { useState, useEffect, useCallback } from "react"

import TimeMethods from "./components/timeseries";
import DemographicPopulation, { DemographicData } from "./components/demographic";
import Cohort from "./components/cohort";
import dynamic from "next/dynamic";
import { Info } from "lucide-react";

const PopulationChart = dynamic(() => import("./components/PopulationChart"), { ssr: false })

declare global {
    interface Window {
        population2025: any;
        selectedPopulationForecast2025: any;
        selectedMethod: string;
        selectedPopulationForecast?: Record<number, number>;
        selectedPopulationMethod?: string;
        methodGrowthAnalysis?: any;
        selectedMethodReason?: string;
    }
}

interface YearlyGrowthData {
    [year: number]: {
        population: number;
        growthRate: number;
    };
}

interface MethodGrowthAnalysis {
    [methodName: string]: {
        basePopulation: number;
        yearlyGrowthData: YearlyGrowthData;
        avgGrowthRate: number;
        totalYears: number;
    };
}

interface Village {
    id: number;
    name: string;
    subDistrictId: number;
    population: number;
}

interface SubDistrict {
    id: number;
    name: string;
    districtId: number;
}

interface District {
    id: number;
    name: string;
    stateId?: number;
}

interface CohortData {
    year: number;
    data: {
        [ageGroup: string]: {
            male: number;
            female: number;
            total: number;
        };
    };
}

// Enhanced interface with multiple district support
interface PopulationProps {
    villages_props: Village[];
    subDistricts_props: SubDistrict[];
    districts_props?: District[];              // NEW: Multiple districts support
    totalPopulation_props: number;
    demographicData?: DemographicData;
    state_props?: { id: string; name: string };        // Single state (unchanged)
    district_props?: { id: string; name: string };     // Backward compatibility
    sourceMode?: 'admin' | 'drain';
}

const Population: React.FC<PopulationProps> = ({
    villages_props = [],
    subDistricts_props = [],
    districts_props = [],              // NEW: Multiple districts
    totalPopulation_props = 0,
    demographicData,
    state_props,
    district_props,                    // Keep for backward compatibility
    sourceMode = 'admin'
}) => {
    const [single_year, setSingleYear] = useState<number | null>(null);
    const [range_year_start, setRangeYearStart] = useState<number | null>(null);
    const [range_year_end, setRangeYearEnd] = useState<number | null>(null);
    const [range_year_intermediate, setRangeYearIntermediate] = useState<number | null>(null);
    const [inputMode, setInputMode] = useState<'single' | 'range' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [demographicError, setDemographicError] = useState<string | null>(null);
    const [methods, setMethods] = useState({
        timeseries: false,
        demographic: false,
        cohort: false
    });
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<any | null>(null);
    const [cohortData, setCohortData] = useState<CohortData[] | null>(null);
    const [cohortPopulationData, setCohortPopulationData] = useState<{ [year: string]: number } | null>(null);
    const [selectedMethod, setSelectedMethodd] = useState<string>("");
    const [localDemographicData, setLocalDemographicData] = useState<DemographicData>(demographicData || {
        annualBirthRate: "",
        annualDeathRate: "",
        annualEmigrationRate: "",
        annualImmigrationRate: ""
    });

    const [cohortRequestPending, setCohortRequestPending] = useState(false);


    // Debug logging - unchanged
    useEffect(() => {
        // console.log("Population component received data:");
        // console.log("Villages:", villages_props);
        // console.log("SubDistricts:", subDistricts_props);
        // console.log("Districts (multiple):", districts_props);
        // console.log("District (single - backward compatibility):", district_props);
        // console.log("Total Population:", totalPopulation_props);
        // console.log("Source Mode:", sourceMode);

        const calculatedTotal = villages_props.reduce((sum, village) => sum + (village.population || 0), 0);
        //console.log("Calculated total population from villages:", calculatedTotal);

        if (calculatedTotal === 0) {
            //console.warn("WARNING: Total population from villages is 0!");
        }
    }, [villages_props, subDistricts_props, districts_props, district_props, totalPopulation_props, sourceMode]);

    // All existing useEffects remain unchanged
    useEffect(() => {
        if (single_year !== null && (single_year > 0)) {
            setInputMode('single');
            if (range_year_start !== null || range_year_end !== null) {
                setRangeYearStart(null);
                setRangeYearEnd(null);
            }
        } else if ((range_year_start !== null && range_year_start > 0) ||
            (range_year_end !== null && range_year_end > 0)) {
            setInputMode('range');
            if (single_year !== null) {
                setSingleYear(null);
            }
        } else if (range_year_start === null && range_year_end === null && single_year === null) {
            setInputMode(null);
        }
    }, [single_year, range_year_start, range_year_end]);

    // Validation logic - unchanged
    useEffect(() => {
        if (inputMode === 'single') {
            if (single_year !== null && (single_year < 2011 || single_year > 2099)) {
                setError('Year must be between 2011 and 2099');
            } else {
                setError(null);
            }
        } else if (inputMode === 'range') {
            if (range_year_start !== null && (range_year_start < 2011 || range_year_start > 2099)) {
                setError('Start year must be between 2011 and 2099');
            } else if (range_year_end !== null && (range_year_end < 2011 || range_year_end > 2099)) {
                setError('End year must be between 2011 and 2099');
            } else if (range_year_intermediate !== null && (range_year_intermediate < 2011 || range_year_intermediate > 2099)) {
                setError('Intermediate year must be between 2011 and 2099');
            } else if (range_year_start !== null && range_year_end !== null &&
                range_year_start >= range_year_end) {
                setError('End year must be greater than start year');
            } else if (range_year_start !== null && range_year_intermediate !== null &&
                range_year_intermediate <= range_year_start) {
                setError('Intermediate year must be greater than start year');
            } else if (range_year_intermediate !== null && range_year_end !== null &&
                range_year_intermediate >= range_year_end) {
                setError('Intermediate year must be less than end year');
            } else {
                setError(null);
            }
        } else {
            setError(null);
        }
    }, [inputMode, single_year, range_year_start, range_year_end, range_year_intermediate]);

    // All existing handlers remain unchanged
    const handleSingleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;
        if (inputValue === '') {
            setSingleYear(null);
            return;
        }
        setSingleYear(parseInt(inputValue));
    };

    const handleRangeStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;
        if (inputValue === '') {
            setRangeYearStart(null);
            return;
        }
        setRangeYearStart(parseInt(inputValue));
    };

    const handleRangeEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;
        if (inputValue === '') {
            setRangeYearEnd(null);
            return;
        }
        setRangeYearEnd(parseInt(inputValue));
    };

    const handleRangeIntermediateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;
        if (inputValue === '') {
            setRangeYearIntermediate(null);
            return;
        }
        setRangeYearIntermediate(parseInt(inputValue));
    };

    const handleMethodChange = (method: 'timeseries' | 'demographic' | 'cohort') => {
        const newMethods = {
            ...methods,
            [method]: !methods[method]
        };
        setMethods(newMethods);
        if (method === 'cohort' && methods.cohort && !newMethods.cohort) {
            setCohortData(null);
            setCohortPopulationData(null);
            if (results && results.Cohort) {
                const newResults = { ...results };
                delete newResults.Cohort;
                setResults(newResults);
                if (selectedMethod === 'Cohort') {
                    const availableMethods = Object.keys(newResults);
                    if (availableMethods.length > 0) {
                        setSelectedMethodd(availableMethods[0]);
                    } else {
                        setSelectedMethodd("");
                    }
                }
            }
        }
    };

    const handleLocalDemographicDataChange = useCallback((data: React.SetStateAction<DemographicData>) => {
        //console.log("Local demographic data updated:", data);
        setLocalDemographicData(data);
        setDemographicError(null);
    }, []);

    const isMethodSelected = methods.timeseries || methods.demographic || methods.cohort;

    useEffect(() => {
        if (results && selectedMethod) {
            (window as any).selectedPopulationForecast = results[selectedMethod];
            (window as any).populationForecastResults = results;
            //console.log("Updated selectedPopulationForecast:", (window as any).selectedPopulationForecast);
        }
    }, [selectedMethod, results]);


    useEffect(() => {
        if (results && Object.keys(results).length > 0) {
            // Save all population forecasting results to window for PDF access
            (window as any).populationForecastResults = results;
            //console.log("Saved population forecast results to window:", results);
        }
    }, [results]);

    // Existing helper functions remain unchanged
    const extractCohortPopulation = (cohortDataArray: CohortData[] | null) => {
        if (!cohortDataArray || cohortDataArray.length === 0) return null;
        const populationByYear: { [year: string]: number } = {};

        cohortDataArray.forEach(cohortItem => {
            if (!cohortItem || !cohortItem.data) return;

            const totalPop = cohortItem.data.total?.total ||
                Object.entries(cohortItem.data || {})
                    .filter(([key]) => key !== 'total')
                    .reduce((sum, [_, ageGroup]) => sum + (ageGroup?.total || 0), 0);

            if (cohortItem.year) {
                populationByYear[cohortItem.year.toString()] = totalPop || 0;
            }
        });

        return populationByYear;
    };

    const generateFallbackTimeSeriesData = (
        basePopulation: number,
        singleYear: number | null,
        startYear: number | null,
        endYear: number | null
    ) => {
        const result: {
            Arithmetic: Record<number, number>;
            Geometric: Record<number, number>;
            Incremental: Record<number, number>;
            Exponential: Record<number, number>;
        } = {
            Arithmetic: {},
            Geometric: {},
            Incremental: {},
            Exponential: {},
        };

        let years = [];
        if (singleYear) {
            years = [2011, singleYear];
        } else if (startYear && endYear) {
            for (let y = startYear; y <= endYear; y++) {
                years.push(y);
            }
            if (!years.includes(2011)) years.push(2011);
        } else {
            years = [2011, 2021, 2031, 2041, 2051];
        }

        years.sort((a, b) => a - b);

        years.forEach(year => {
            const yearsSince2011 = year - 2011;
            const growthRate = 0.02;
            result['Arithmetic'][year] = Math.round(basePopulation * (1 + yearsSince2011 * growthRate));
            result['Geometric'][year] = Math.round(basePopulation * Math.pow(1 + growthRate, yearsSince2011));
            const incrementalFactor = 1 + (growthRate + yearsSince2011 * 0.001);
            result['Incremental'][year] = Math.round(basePopulation * incrementalFactor);
            result['Exponential'][year] = Math.round(basePopulation * Math.exp(growthRate * yearsSince2011));
        });

        return result;
    };

    // Enhanced 2025 API call with multiple location support
    useEffect(() => {
        if (selectedMethod && selectedMethod.toLowerCase().includes('cohort')) {
            // Enhanced request body building with multiple location support
            // const requestBody = {
            //     "year": 2025,
            //     "start_year": null,
            //     "end_year": null,
            //     "state_props": state_props,

            //     // Enhanced district props - multiple or single
            //     "district_props": (() => {
            //         if (districts_props && districts_props.length > 0) {
            //             // Multiple districts
            //             return districts_props.map(d => ({
            //                 id: d.id.toString(),
            //                 name: d.name
            //             }));
            //         } else if (district_props?.id) {
            //             // Single district (backward compatibility)
            //             return {
            //                 id: district_props.id.toString(),
            //                 name: district_props.name
            //             };
            //         }
            //         return undefined;
            //     })(),

            //     // Enhanced subdistrict props - multiple or single
            //     "subdistrict_props": (() => {
            //         if (subDistricts_props.length > 1) {
            //             // Multiple subdistricts
            //             return subDistricts_props.map(sd => ({
            //                 id: sd.id.toString(),
            //                 name: sd.name
            //             }));
            //         } else if (subDistricts_props.length === 1) {
            //             // Single subdistrict
            //             return {
            //                 id: subDistricts_props[0].id.toString(),
            //                 name: subDistricts_props[0].name
            //             };
            //         }
            //         return undefined;
            //     })(),

            //     "villages_props": villages_props.map(village => ({
            //         id: village.id.toString(),
            //         name: village.name,
            //         subDistrictId: village.subDistrictId.toString(),
            //         subDistrictName: subDistricts_props.find(sd => sd.id === village.subDistrictId)?.name || "",
            //         districtName: district_props?.name || ""
            //     }))
            // };
            const requestBody = {
                "year": 2025,
                "start_year": null,
                "end_year": null,
                "villages_props": villages_props.map(village => ({
                    id: village.id.toString(),
                    name: village.name,
                    population: village.population || 0
                    // Remove subDistrictId, subDistrictName, districtName
                }))
                // Remove state_props, district_props, subdistrict_props
            };

            //console.log("Enhanced 2025 cohort request:", requestBody);

            fetch('/django/cohort/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            })
                .then(response => {
                    if (!response.ok) throw new Error(`API error: ${response.status}`);
                    return response.json();
                })
                .then(result => {
                    //console.log('API Response for sourceMode:', sourceMode, result);
                    window.population2025 = null;
                    window.selectedPopulationForecast2025 = null;

                    if (result.cohort) {
                        let totalPop = 0;

                        if (Array.isArray(result.cohort)) {
                            const cohort2025 = result.cohort.find((item: { year: number; }) => item.year === 2025);
                            if (cohort2025 && cohort2025.data) {
                                totalPop = cohort2025.data.total?.total ||
                                    Object.entries(cohort2025.data)
                                        .filter(([key]) => key !== 'total')
                                        .reduce((sum, [_, ageGroup]) => sum + ((ageGroup as { total?: number })?.total || 0), 0);

                            }
                        } else {
                            totalPop = result.cohort.data.total?.total ||
                                Object.entries(result.cohort.data)
                                    .filter(([key]) => key !== 'total')
                                    .reduce((sum, [_, ageGroup]) => sum + ((ageGroup as { total?: number })?.total || 0), 0);

                        }

                        window.population2025 = totalPop;
                        window.selectedPopulationForecast2025 = totalPop;
                        window.selectedMethod = "Cohort";
                    }
                })
                .catch(error => {
                    //console.log("Error fetching 2025 population:", error);
                });
        } else if (selectedMethod) {
            // Handle other methods - unchanged logic
            let apiEndpoint = '';
            let requestBody = {};

            if (selectedMethod.toLowerCase().includes('demographic')) {
                apiEndpoint = '/django/time_series/demographic/';
                requestBody = {
                    "start_year": null,
                    "end_year": null,
                    "year": 2025,
                    "villages_props": villages_props,
                    "subdistrict_props": subDistricts_props,
                    "totalPopulation_props": totalPopulation_props,
                    "demographic": localDemographicData ? {
                        "birthRate": localDemographicData.annualBirthRate === "" ? null : localDemographicData.annualBirthRate,
                        "deathRate": localDemographicData.annualDeathRate === "" ? null : localDemographicData.annualDeathRate,
                        "emigrationRate": localDemographicData.annualEmigrationRate === "" ? null : localDemographicData.annualEmigrationRate,
                        "immigrationRate": localDemographicData.annualImmigrationRate === "" ? null : localDemographicData.annualImmigrationRate
                    } : null
                };
            } else {
                apiEndpoint = '/django/time_series/arthemitic/';
                requestBody = {
                    "start_year": null,
                    "end_year": null,
                    "year": 2025,
                    "method": selectedMethod.toLowerCase().includes('exponential') ? "exponential" : undefined,
                    "villages_props": villages_props,
                    "subdistrict_props": subDistricts_props,
                    "totalPopulation_props": totalPopulation_props
                };
            }

            if (apiEndpoint) {
                fetch(apiEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody)
                })
                    .then(response => {
                        if (!response.ok) throw new Error(`API error: ${response.status}`);
                        return response.json();
                    })
                    .then(result => {
                        // Existing processing logic unchanged
                        //console.log('API Response for sourceMode:', sourceMode, result);
                        window.population2025 = null;
                        window.selectedPopulationForecast2025 = null;

                        if (selectedMethod.toLowerCase().includes('demographic')) {
                            if (result.demographic) {
                                window.population2025 = result.demographic['2025'];
                                window.selectedPopulationForecast2025 = result.demographic['2025'];
                                window.selectedMethod = "Demographic";
                            }
                            // ... rest of demographic processing unchanged
                        } else {
                            if (result[selectedMethod] && result[selectedMethod]['2025']) {
                                window.population2025 = result[selectedMethod]['2025'];
                                window.selectedPopulationForecast2025 = result[selectedMethod]['2025'];
                                window.selectedMethod = selectedMethod;
                            }
                            // ... rest of processing unchanged
                        }
                    })
                    .catch(error => {
                        //console.log("Error fetching 2025 population:", error);
                    });
            }
        }
    }, [selectedMethod, localDemographicData, sourceMode, districts_props, district_props]);

    // Enhanced processCohortData - unchanged
    const processCohortData = async (cohortApiRequest: Promise<any>) => {
        try {
            const response = await cohortApiRequest;
            let allCohortData: CohortData[] = [];

            //console.log('Cohort API Response:', response);

            if (response?.cohort) {
                if (Array.isArray(response.cohort)) {
                    allCohortData = response.cohort;
                } else {
                    allCohortData = [response.cohort];
                }
            } else {
                //console.warn('No cohort data found in response:', response);
            }

            allCohortData.sort((a, b) => (a?.year || 0) - (b?.year || 0));
            // ✅ Fix 2011 population using Exponential method's 2011 data
            const exponential2011Population = results?.Exponential?.[2011] || totalPopulation_props;
            allCohortData = allCohortData.map((item) =>
                item.year === 2011
                    ? {
                        ...item,
                        population: exponential2011Population,
                        data: item.data ? {
                            ...item.data,
                            total: { ...item.data.total, total: exponential2011Population }
                        } : item.data
                    }
                    : item
            );

            //console.log('Processed cohort data:', allCohortData);
            setCohortData(allCohortData);

            const cohortPopulation = extractCohortPopulation(allCohortData);
            setCohortPopulationData(cohortPopulation);
            return cohortPopulation;

        } catch (error) {
            //console.log('Error processing cohort data:', error);
            setError('Failed to process cohort data. Please try again.');
            return null;
        } finally {
            setCohortRequestPending(false);
        }
    };

    // Enhanced handleSubmit with multiple location support AND NEW GROWTH RATE SELECTION
    const handleSubmit = async () => {
        setLoading(true);
        setError(null);
        setDemographicError(null);

        try {
            //console.log("methods", methods);

            if (!isMethodSelected) {
                setError('Please select at least one method');
                setLoading(false);
                return;
            }

            if (methods.demographic) {
                const { annualBirthRate, annualDeathRate, annualEmigrationRate, annualImmigrationRate } = localDemographicData;
                if (
                    annualBirthRate === "" ||
                    annualDeathRate === "" ||
                    annualEmigrationRate === "" ||
                    annualImmigrationRate === ""
                ) {
                    setDemographicError('Please fill in all demographic fields (Birth Rate, Death Rate, Emigration Rate, Immigration Rate).');
                    setLoading(false);
                    return;
                }
            }

            setResults(null);
            setCohortData(null);
            setCohortPopulationData(null);

            let requests = [];
            let requestTypes = [];
            let cohortApiRequest = null;

            // ENHANCED COHORT API CALL with multiple location support
            if (methods.cohort) {
                setCohortRequestPending(true);
                // this API is for cohort not it post only village props 
                // let cohortRequestBody: any = {
                //     state_props,

                //     // Enhanced district handling - multiple or single
                //     district_props: (() => {
                //         if (districts_props && districts_props.length > 0) {
                //             // Multiple districts
                //             return districts_props.map(d => ({
                //                 id: d.id.toString(),
                //                 name: d.name || "Unknown"
                //             }));
                //         } else if (district_props?.id) {
                //             // Single district (backward compatibility)
                //             return {
                //                 id: district_props.id.toString(),
                //                 name: district_props.name || "Unknown"
                //             };
                //         }
                //         return undefined;
                //     })(),

                //     // Enhanced subdistrict handling - multiple or single
                //     subdistrict_props: (() => {
                //         if (subDistricts_props.length > 1) {
                //             // Multiple subdistricts
                //             return subDistricts_props.map(sd => ({
                //                 id: sd.id.toString(),
                //                 name: sd.name || "Unknown"
                //             }));
                //         } else if (subDistricts_props.length === 1) {
                //             // Single subdistrict
                //             return {
                //                 id: subDistricts_props[0].id.toString(),
                //                 name: subDistricts_props[0].name || "Unknown"
                //             };
                //         }
                //         return undefined;
                //     })(),

                //     villages_props: villages_props.map((village) => ({
                //         id: village.id.toString(),
                //         name: village.name || "Unknown",
                //         subDistrictId: village.subDistrictId?.toString() || "0",
                //         subDistrictName: subDistricts_props.find((sd) => sd.id === village.subDistrictId)?.name || '',
                //         districtName: district_props?.name || '',
                //         population: village.population || 0
                //     })),
                // };
                let cohortRequestBody: any = {
                    villages_props: villages_props.map((village) => ({
                        id: village.id.toString(),
                        name: village.name || "Unknown",
                        population: village.population || 0
                        // Remove subDistrictId, subDistrictName, districtName if not needed
                    })),
                };

                // Year parameters - unchanged
                if (single_year !== null) {
                    cohortRequestBody.year = single_year;
                    cohortRequestBody.start_year = null;
                    cohortRequestBody.end_year = null;
                    //console.log('Cohort request - Single year mode:', single_year);
                } else if (range_year_start !== null && range_year_end !== null) {
                    cohortRequestBody.start_year = range_year_start;
                    cohortRequestBody.end_year = range_year_end;
                    cohortRequestBody.year = null;
                    //console.log('Cohort request - Range mode:', range_year_start, 'to', range_year_end);
                } else {
                    cohortRequestBody.year = 2036;
                    cohortRequestBody.start_year = null;
                    cohortRequestBody.end_year = null;
                    //console.log('Cohort request - Default mode: 2036');
                }

                //console.log('Enhanced cohort request body:', cohortRequestBody);

                cohortApiRequest = fetch('/django/cohort/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(cohortRequestBody)
                }).then((response) => {
                    if (!response.ok) {
                        throw new Error(`Cohort API error: ${response.status} - ${response.statusText}`);
                    }
                    return response.json();
                });
            }

            // Time series and demographic handling - unchanged
            if (methods.timeseries) {
                try {
                    //console.log("Attempting time series API with totalPopulation:", totalPopulation_props);

                    const timeSeriesResponse = await fetch('/django/time_series/arthemitic/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            start_year: range_year_start,
                            end_year: range_year_end,
                            year: single_year,
                            villages_props: villages_props,
                            subdistrict_props: subDistricts_props,
                            totalPopulation_props: totalPopulation_props,
                        }),
                    });

                    if (timeSeriesResponse.ok) {
                        const timeSeriesData = await timeSeriesResponse.json();
                        //console.log("Time series API succeeded:", timeSeriesData);
                        requests.push(Promise.resolve(timeSeriesData));
                        requestTypes.push('timeseries');
                    } else {
                        //console.warn(`Time series API failed with status ${timeSeriesResponse.status}, using fallback`);
                        const fallbackData = generateFallbackTimeSeriesData(
                            totalPopulation_props,
                            single_year,
                            range_year_start,
                            range_year_end
                        );
                        //console.log("Generated fallback time series data:", fallbackData);
                        requests.push(Promise.resolve(fallbackData));
                        requestTypes.push('timeseries');
                    }
                } catch (error) {
                    //console.log("Error in time series API:", error);
                    const fallbackData = generateFallbackTimeSeriesData(
                        totalPopulation_props,
                        single_year,
                        range_year_start,
                        range_year_end
                    );
                    //console.log("Generated fallback time series data after error:", fallbackData);
                    requests.push(Promise.resolve(fallbackData));
                    requestTypes.push('timeseries');
                }
            }

            if (methods.demographic) {
                requests.push(
                    fetch('/django/time_series/demographic/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            start_year: range_year_start,
                            end_year: range_year_end,
                            year: single_year,
                            villages_props: villages_props || [],
                            subdistrict_props: subDistricts_props || [],
                            totalPopulation_props: totalPopulation_props || 0,
                            demographic: {
                                birthRate: localDemographicData.annualBirthRate,
                                deathRate: localDemographicData.annualDeathRate,
                                emigrationRate: localDemographicData.annualEmigrationRate,
                                immigrationRate: localDemographicData.annualImmigrationRate,
                            },
                        }),
                    }).then((response) => {
                        if (!response.ok) throw new Error(`Demographic API error: ${response.status}`);
                        return response.json();
                    })
                );
                requestTypes.push('demographic');
            }

            let result: { [key: string]: any } = {};

            if (requests.length > 0) {
                const responses = await Promise.all(requests);
                responses.forEach((response, index) => {
                    const requestType = requestTypes[index];
                    if (requestType === 'timeseries') {
                        result = { ...result, ...response };
                    } else if (requestType === 'demographic') {
                        if (response.Demographic) {
                            result.Demographic = response.Demographic;
                        } else if (response.demographic) {
                            result.Demographic = response.demographic;
                        }
                        if (response.population) {
                            result = { ...result, ...response.population };
                        }
                        const populationKeys = Object.keys(response).filter(
                            (key) => key !== 'demographic' && key !== 'Demographic' && typeof response[key] === 'object'
                        );
                        populationKeys.forEach((key) => {
                            result[key] = response[key];
                        });
                    }
                });
            }

            if (cohortApiRequest) {
                const cohortPopulation = await processCohortData(cohortApiRequest);
                if (cohortPopulation && Object.keys(cohortPopulation).length > 0) {
                    result.Cohort = cohortPopulation;
                }
            }

            setResults(result);
            (window as any).populationForecastResults = result;

            // === NEW METHOD SELECTION LOGIC BASED ON MINIMUM AVERAGE GROWTH RATE ===
            //console.log("=== CALCULATING METHOD SELECTION BASED ON GROWTH RATES ===");

            const methodGrowthAnalysis: MethodGrowthAnalysis = {};
            let finalSelectedMethod = '';
            let minAvgGrowthRate = Infinity; // Start with Infinity to find minimum

            // Process each method
            Object.keys(result).forEach((methodName) => {
                const methodData = result[methodName];

                if (methodData && typeof methodData === 'object') {
                    const years = Object.keys(methodData).map(Number).sort((a, b) => a - b);
                    const baseYear = 2011;
                    const basePopulation = methodData[baseYear];

                    if (!basePopulation) {
                        //console.warn(`No base population (2011) found for method: ${methodName}`);
                        return;
                    }

                    // Calculate growth rates for each year (except 2011)
                    const growthRates: number[] = []; // Fixed: Explicit number[] type
                    const yearlyGrowthData: YearlyGrowthData = {}; // Fixed: Proper type

                    years.forEach(year => {
                        if (year !== baseYear) {
                            const currentPopulation = methodData[year];
                            // Growth rate formula: [(Year_Population - 2011_Population) / 2011_Population] × 100
                            const growthRate = ((currentPopulation - basePopulation) / basePopulation) * 100;

                            growthRates.push(growthRate);
                            yearlyGrowthData[year] = {
                                population: currentPopulation,
                                growthRate: parseFloat(growthRate.toFixed(2))
                            };
                        }
                    });

                    // Calculate average growth rate for this method
                    const avgGrowthRate = growthRates.length > 0
                        ? growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length
                        : 0;

                    // Store analysis data
                    methodGrowthAnalysis[methodName] = {
                        basePopulation,
                        yearlyGrowthData,
                        avgGrowthRate: parseFloat(avgGrowthRate.toFixed(2)),
                        totalYears: growthRates.length
                    };

                    // FIXED: Check if this method has the MINIMUM average growth rate
                    if (avgGrowthRate < minAvgGrowthRate) {
                        minAvgGrowthRate = avgGrowthRate;
                        finalSelectedMethod = methodName;
                    }

                    // console.log(`Method: ${methodName}`);
                    // console.log(`  Base Population (2011): ${basePopulation.toLocaleString()}`);
                    // console.log(`  Average Growth Rate: ${avgGrowthRate.toFixed(2)}%`);
                    // console.log(`  Yearly Growth Data:`, yearlyGrowthData);
                }
            });

            // console.log("=== GROWTH RATE ANALYSIS COMPLETE ===");
            // console.log("Method Growth Analysis:", methodGrowthAnalysis);
            // console.log(`SELECTED METHOD (Minimum Avg Growth): ${finalSelectedMethod} (${minAvgGrowthRate.toFixed(2)}%)`);

            // Store growth analysis in window for debugging/access
            (window as any).methodGrowthAnalysis = methodGrowthAnalysis;
            (window as any).selectedMethodReason = `Minimum Average Growth Rate: ${minAvgGrowthRate.toFixed(2)}%`;

            // Log growth rate tables
            //console.log("=== GROWTH RATE TABLE ===");
            const allYears = new Set<number>();
            Object.values(result).forEach(methodData => {
                Object.keys(methodData).forEach(year => allYears.add(Number(year)));
            });
            const years = Array.from(allYears).sort((a, b) => a - b);

            const tableData: { [year: number]: { [method: string]: string } } = {};
            years.forEach(year => {
                if (year !== 2011) {
                    tableData[year] = {};
                    Object.keys(result).forEach(method => {
                        const methodData = result[method];
                        const basePopulation = methodData[2011];
                        const currentPopulation = methodData[year];

                        if (basePopulation && currentPopulation) {
                            const growthRate = ((currentPopulation - basePopulation) / basePopulation) * 100;
                            tableData[year][method] = `${growthRate.toFixed(2)}%`;
                        }
                    });
                }
            });
            //console.table(tableData);

            //console.log("=== AVERAGE GROWTH RATES BY METHOD ===");
            const avgGrowthRates: { [method: string]: string } = {};
            Object.keys(result).forEach(method => {
                if (methodGrowthAnalysis[method]) { // Fixed: Now properly typed
                    avgGrowthRates[method] = methodGrowthAnalysis[method].avgGrowthRate + '%';
                }
            });
            //console.table(avgGrowthRates);

            // Use the new selection logic - MINIMUM average growth rate
            const finalMethod = selectedMethod || finalSelectedMethod;
            setSelectedMethodd(finalMethod);
            (window as any).selectedPopulationForecast = result[finalMethod];

            // console.log('Selected Method (Based on Min Avg Growth Rate):', finalMethod);
            // console.log('Selection Reason:', (window as any).selectedMethodReason);
            // console.log('Selected Population Forecast:', (window as any).selectedPopulationForecast);

        } catch (error) {
            //console.log('Error in calculate:', error);
            setError('An error occurred during calculation. Please try again.');
        } finally {
            setLoading(false);
            setCohortRequestPending(false);
        }
    };

    // Existing getYears function - unchanged
    const getYears = (data: any) => {
        if (!data) return [];
        const allYears = new Set<number>();

        Object.keys(data || {}).forEach((modelName) => {
            const model = data[modelName];
            if (modelName !== 'Demographic' && typeof model === 'object' && model !== null) {
                Object.keys(model || {}).forEach((year) => {
                    const yearNum = Number(year);
                    if (!isNaN(yearNum)) {
                        allYears.add(yearNum);
                    }
                });
            } else if (modelName === 'Demographic' && typeof model === 'object' && model !== null) {
                Object.keys(model || {}).forEach((year) => {
                    const yearNum = Number(year);
                    if (!isNaN(yearNum)) {
                        allYears.add(yearNum);
                    }
                });
            }
        });

        return Array.from(allYears).sort((a, b) => a - b);
    };

    // All existing JSX remains unchanged - just the component logic is enhanced
    return (
        
            <div className="w-full max-w-none p-4 lg:p-6 xl:p-8">
                <div className="bg-white rounded-md border-1 shadow-md p-4 lg:p-6">
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 mb-6">Population Estimation and Forecasting</h1>

                    <div className="mb-4">
                        <h2 className="text-lg font-semibold text-gray-700 mb-3">Select Design Year</h2>
                        <div className="bg-blue-50 p-4 mb-4 rounded-md text-sm text-blue-700">
                            Please use either a single year or a range of years, not both. Years must be between 2011 and 2099.
                        </div>
                    </div>

                    <div className="mb-4 p-4 rounded-md border border-gray-200">
                        <h3 className="font-medium text-gray-700 mb-3">Select Design Year</h3>
                        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-end gap-4">
                            <div className={`w-full sm:w-auto ${inputMode === 'range' ? 'opacity-60' : ''}`}>
                                <label className="block text-gray-700 font-medium mb-2" htmlFor="single-year">
                                    Single Year
                                </label>
                                <input
                                    id="single-year"
                                    type="number"
                                    className={`w-full sm:w-32 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 
                                    ${inputMode === 'range' ? 'bg-gray-200 cursor-not-allowed' : 'focus:ring-blue-500 border-gray-300'}`}
                                    value={single_year === null ? '' : single_year}
                                    onChange={handleSingleYearChange}
                                    placeholder="Year"
                                    disabled={inputMode === 'range'}
                                    min="2011"
                                    max="2099"
                                />
                            </div>
                            <div className="hidden sm:block mx-4 text-gray-500 self-center">OR</div>
                            <div className="sm:hidden w-full text-center text-gray-500 py-2">OR</div>
                            <div className={`w-full sm:w-auto ${inputMode === 'single' ? 'opacity-60' : ''}`}>
                                <label className="block text-gray-700 mb-2" htmlFor="range-start">
                                    Initial Year
                                </label>
                                <input
                                    id="range-start"
                                    type="number"
                                    className={`w-full sm:w-32 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 
                                       ${inputMode === 'single' ? 'bg-gray-200 cursor-not-allowed' : 'focus:ring-blue-500 border-gray-300'}`}
                                    value={range_year_start === null ? '' : range_year_start}
                                    onChange={handleRangeStartChange}
                                    placeholder="Start"
                                    disabled={inputMode === 'single'}
                                    min="2011"
                                    max="2099"
                                />
                            </div>

                            <div className={`w-full sm:w-auto ${inputMode === 'single' ? 'opacity-60' : ''}`}>
                                <label className="block text-gray-700 mb-2" htmlFor="intermediate-year">
                                    Intermediate Year
                                </label>
                                <input
                                    id="intermediate-year"
                                    type="number"
                                    className={`w-full sm:w-32 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 
                ${inputMode === 'single' ? 'bg-gray-200 cursor-not-allowed' : 'focus:ring-blue-500 border-gray-300'}`}
                                    value={range_year_intermediate === null ? '' : range_year_intermediate}
                                    onChange={handleRangeIntermediateChange}
                                    placeholder="Mid"
                                    disabled={inputMode === 'single'}
                                    min="2011"
                                    max="2099"
                                />
                            </div>

                            <div className={`w-full sm:w-auto ${inputMode === 'single' ? 'opacity-60' : ''}`}>
                                <label className="block text-gray-700 mb-2" htmlFor="range-end">
                                    Ultimate Year
                                </label>
                                <input
                                    id="range-end"
                                    type="number"
                                    className={`w-full sm:w-32 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 
                                       ${inputMode === 'single' ? 'bg-gray-200 cursor-not-allowed' : 'focus:ring-blue-500 border-gray-300'}`}
                                    value={range_year_end === null ? '' : range_year_end}
                                    onChange={handleRangeEndChange}
                                    placeholder="End"
                                    disabled={inputMode === 'single'}
                                    min="2011"
                                    max="2099"
                                />
                            </div>
                        </div>
                        {error && (
                            <div className="mt-3 text-red-500 text-sm">{error}</div>
                        )}
                    </div>

                    <div className="mb-4 p-4 rounded-md border border-gray-200">
                        <h3 className="font-medium text-gray-700 mb-3">Calculation Methods</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <label className="inline-flex items-center">
                                <input
                                    type="checkbox"
                                    className="form-checkbox h-5 w-5 text-blue-600"
                                    checked={methods.timeseries}
                                    onChange={() => handleMethodChange('timeseries')}
                                />
                                <span className="ml-2 text-gray-700">Time Series</span>
                            </label>
                            <label className="inline-flex items-center">
                                <input
                                    type="checkbox"
                                    className="form-checkbox h-5 w-5 text-blue-600"
                                    checked={methods.demographic}
                                    onChange={() => handleMethodChange('demographic')}
                                />
                                <span className="ml-2 text-gray-700">Demographic</span>
                            </label>
                            <label className="inline-flex items-center">
                                <input
                                    type="checkbox"
                                    className="form-checkbox h-5 w-5 text-blue-600"
                                    checked={methods.cohort}
                                    onChange={() => handleMethodChange('cohort')}
                                />
                                <span className="ml-2 text-gray-700">Cohort</span>
                            </label>
                        </div>
                        {!isMethodSelected && (
                            <div className="mt-2 text-red-500 text-sm">Please select at least one calculation method</div>
                        )}
                    </div>

                    {methods.timeseries && (
                        <div className="mb-4 p-4 rounded-md border border-gray-200">
                            <h3 className="font-medium text-gray-700 mb-3">Time Series Analysis</h3>
                            <TimeMethods />
                        </div>
                    )}
                    {methods.demographic && (
                        <div className="mb-4 p-4 rounded-md border border-gray-200">
                            <h3 className="font-medium text-gray-700 mb-3">Demographic Analysis</h3>
                            <DemographicPopulation
                                onDataChange={handleLocalDemographicDataChange}
                                initialData={demographicData}
                            />
                            {demographicError && (
                                <div className="mt-3 text-red-500 text-sm">{demographicError}</div>
                            )}
                        </div>
                    )}

                    <div className="mt-6">
                        <button
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 flex items-center justify-center gap-2"
                            disabled={
                                loading ||
                                cohortRequestPending ||
                                (inputMode === 'single' && (single_year === null || single_year < 2011 || single_year > 2099)) ||
                                (inputMode === 'range' && (range_year_start === null || range_year_end === null ||
                                    range_year_start < 2011 || range_year_start > 2099 ||
                                    range_year_end < 2011 || range_year_end > 2099 ||
                                    error !== null)) ||
                                inputMode === null ||
                                !isMethodSelected
                            }
                            onClick={handleSubmit}
                        >
                            {loading || cohortRequestPending ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            ) : (
                                "Calculate"
                            )}
                        </button>
                    </div>
                </div>

                {results && (
                    <div className="mt-8 w-full">
                        <div className="bg-white rounded-lg shadow-md p-4 lg:p-6">
                            <h2 className="text-2xl lg:text-3xl font-bold text-blue-800 mb-6">Population Data</h2>
                            <div className="w-full overflow-hidden border border-gray-200 rounded-xl shadow-lg bg-white">
                                <div className="overflow-x-auto">
                                    <div className="max-h-96 overflow-y-auto">
                                        <table className="w-full min-w-[600px] border-collapse">
                                            <thead className="sticky top-0 z-10 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700">
                                                <tr>
                                                    <th className="border-b px-3 lg:px-6 py-4 text-left font-semibold text-sm w-20 lg:w-28">Year</th>
                                                    {Object.keys(results || {}).map(
                                                        (method) => (
                                                            <th
                                                                key={method}
                                                                className="border-b px-3 lg:px-6 py-4 text-center font-semibold text-sm"
                                                            >
                                                                {method}
                                                            </th>
                                                        )
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {getYears(results).map((year, index) => (
                                                    <tr
                                                        key={year}
                                                        className={`border-b hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-gray-50/50' : 'bg-white'}`}
                                                    >
                                                        <td className="border-b px-3 lg:px-6 py-4 font-medium text-gray-800">{year}</td>
                                                        {Object.keys(results || {}).map(
                                                            (method) => (
                                                                <td
                                                                    key={`${method}-${year}`}
                                                                    className="border-b px-3 lg:px-6 py-4 text-center text-gray-600 text-sm lg:text-base"
                                                                >
                                                                    {method === 'Demographic' ?
                                                                        (results[method] && results[method][year]) ?? '-' :
                                                                        (results[method] && results[method][year]) ?? '-'}
                                                                </td>
                                                            )
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                )}

                {/* Enhanced Cohort Section with proper container */}
                {cohortData && cohortData.length > 0 && (
                    <div className="mt-8 w-full">
                        <div className="bg-white rounded-lg shadow-md p-4 lg:p-6">

                            <div className="w-full overflow-hidden">
                                <Cohort cohortData={cohortData} />
                            </div>
                        </div>
                    </div>
                )}

                {methods.cohort && cohortRequestPending && (
                    <div className="mt-8 w-full">
                        <div className="bg-white rounded-lg shadow-md p-4 lg:p-6">
                            <h2 className="text-2xl lg:text-3xl font-bold text-blue-800 mb-6">Cohort Analysis</h2>
                            <div className="flex items-center justify-center p-12 bg-white border border-gray-200 rounded-xl shadow-lg">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                                <span className="text-gray-600">Loading cohort data...</span>
                            </div>
                        </div>
                    </div>
                )}

                {methods.cohort && !cohortRequestPending && (!cohortData || cohortData.length === 0) && results && (
                    <div className="mt-8 w-full">
                        <div className="bg-white rounded-lg shadow-md p-4 lg:p-6">
                            <h2 className="text-2xl lg:text-3xl font-bold text-blue-800 mb-6">Cohort Analysis</h2>
                            <div className="flex items-center justify-center p-12 bg-white border border-gray-200 rounded-xl shadow-lg">
                                <div className="text-center">
                                    <div className="text-gray-500 mb-2">📊</div>
                                    <p className="text-gray-600">No cohort data available for the selected parameters.</p>
                                    <p className="text-sm text-gray-500 mt-2">Please check your location and year selections.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {results && (
                    <div className="mt-8 w-full">
                        <div className="bg-white rounded-lg shadow-md p-4 lg:p-6">
                            <PopulationChart
                                results={results}
                                intermediateYear={range_year_intermediate}
                            />
                        </div>
                        <div className="mt-6 bg-gray-50 p-4 lg:p-6 rounded-xl shadow-sm border border-gray-200">
                            <div className="flex items-center mb-4 space-x-2">
                                <h3 className="text-lg font-semibold text-gray-800">Select a Method</h3>
                                <div className="relative group">
                                    <Info className="w-5 h-5 text-blue-600 cursor-pointer" />
                                    <div className="absolute left-1/2 -translate-x-1/2 top-full mb-10 -mt-11 ml-50 w-max max-w-xs text-black text-sm rounded-lg shadow-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-all duration-300 ease-in-out z-10 pointer-events-none">
                                        Selected method is automatically chosen based on minimum average growth rate (most conservative). You can override this selection.
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 lg:gap-6">
                                {Object.keys(results).map((method) => (
                                    <label
                                        key={method}
                                        className="flex items-center gap-2 cursor-pointer group"
                                    >
                                        <input
                                            type="radio"
                                            name="selectedMethod"
                                            value={method}
                                            checked={selectedMethod === method}
                                            onChange={() => {
                                                setSelectedMethodd(method);
                                                (window as any).selectedPopulationMethod = method;
                                                // Update selectedMethodReason with the growth rate of the selected method
                                                if ((window as any).methodGrowthAnalysis && (window as any).methodGrowthAnalysis[method]) {
                                                    const avgGrowthRate = (window as any).methodGrowthAnalysis[method].avgGrowthRate;
                                                    (window as any).selectedMethodReason = `Average Growth Rate: ${avgGrowthRate.toFixed(2)}%`;
                                                } else {
                                                    (window as any).selectedMethodReason = `Method: ${method} (Growth rate data unavailable)`;
                                                }
                                            }}
                                            className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 transition"
                                        />
                                        <span className="text-gray-700 font-medium group-hover:text-blue-600 transition">
                                            {method}
                                            {selectedMethod === method && (
                                                <span className="ml-2 text-green-600 text-sm font-bold">✓ SELECTED</span>
                                            )}
                                        </span>
                                    </label>
                                ))}
                            </div>

                            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-blue-700 text-sm">
                                    {(window as any).selectedMethodReason && (
                                        <span className="block mt-1">
                                            <strong>Current selection:</strong> {(window as any).selectedMethodReason}
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        
    )

}

export default Population