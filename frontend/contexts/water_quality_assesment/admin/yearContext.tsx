"use client";

import { api } from "@/services/api";
import React, { createContext, useContext, useState, useEffect } from "react";
import { useLocation } from "./LocationContext";
import { WQIInterface,  WQI_columns } from "@/interface/table";
type YearContextType = {
  years: number[];
  selectedYear: number | null;
  setSelectedYear: (year: number) => void;
  fetchYears: () => Promise<void>;
  wqi_data: WQIInterface[] | null
  setWqiData: React.Dispatch<React.SetStateAction<WQIInterface[] | null>>
  qualityParam: string[]
  selectedParam: string[]
  setSelectedParam: (param: string[]) => void

};

const YearContext = createContext<YearContextType | undefined>(undefined);

export const YearProvider = ({ children }: { children: React.ReactNode }) => {
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [wqi_data, setWqiData] = useState<WQIInterface[] | null>(null);
  const [selectedParam, setSelectedParam] = useState<string[]>([]);
  const [qualityOper, setQualityOper] = useState<boolean>(false);
  const excluded = ["Year", "Longitude", "Latitude", "Location"];
  const qualityParam: string[] = WQI_columns
    .filter(col => !excluded.includes(col.name as string))
    .map(col => col.name as string);

  const {
    selectedSubDistricts,
  } = useLocation();
  const fetchYears = async () => {
    try {
      const res = await api.get("/wqi/year");
      setYears(res.message as [number]);
    } catch (err) {
      console.error("Error fetching years", err);
    }
  };


  useEffect(() => {
    if (!selectedYear || !selectedSubDistricts?.length) return;

    const fetchData = async () => {
      try {
        console.log("Selected year:", selectedYear);
        const resp = await api.post("/wqi/wells", {
          body: {
            subdis_cod: selectedSubDistricts,
            year: selectedYear,
          }
        });
        console.log("Response:", resp.message);
        setWqiData(resp.message as WQIInterface[])
      } catch (error) {
        console.error("Error fetching WQI wells:", error);
      }
    };
    fetchData();
  }, [selectedYear]);


  useEffect(() => {
    fetchYears();
  }, []);

  return (
    <YearContext.Provider
      value={{
        years, selectedYear, setSelectedYear, fetchYears, wqi_data, qualityParam,
        selectedParam, setSelectedParam,  setWqiData,
      }}
    >
      {children}
    </YearContext.Provider>
  );
};

export const useYear = () => {
  const ctx = useContext(YearContext);
  if (!ctx) throw new Error("useYear must be used inside YearProvider");
  return ctx;
};
