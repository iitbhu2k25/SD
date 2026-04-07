'use client';

import ModuleDataTable from "./ModuleDataTable";
import { useGwaWorkflow } from "../hooks/useGwaWorkflow";
import { useGwaStore } from "../store/gwa.store";

const SEASON_OPTIONS = [
  { key: "Kharif", flag: "kharifChecked" as const },
  { key: "Rabi", flag: "rabiChecked" as const },
  { key: "Zaid", flag: "zaidChecked" as const },
];

export default function DemandModule() {
  const { demand, wells, setDemandState } = useGwaStore();
  const { loadCrops, runDomesticDemand, runAgriculturalDemand, runIndustrialDemand } = useGwaWorkflow();

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">Domestic Demand</div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={demand.domesticChecked}
              onChange={(event) => setDemandState({ domesticChecked: event.target.checked })}
            />
            Enable domestic demand
          </label>
          <input
            type="number"
            value={demand.perCapitaConsumption}
            onChange={(event) => setDemandState({ perCapitaConsumption: Number(event.target.value) })}
            className="w-36 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={runDomesticDemand}
            disabled={!wells.csvFilename || !demand.domesticChecked || demand.domesticLoading}
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {demand.domesticLoading ? "Computing..." : "Compute Domestic"}
          </button>
        </div>
        {demand.domesticError && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{demand.domesticError}</div>}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">Agricultural Demand</div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={demand.agriculturalChecked}
              onChange={(event) => setDemandState({ agriculturalChecked: event.target.checked })}
            />
            Enable agricultural demand
          </label>
          <input
            type="number"
            step="0.1"
            value={demand.groundwaterFactor}
            onChange={(event) => setDemandState({ groundwaterFactor: Number(event.target.value) })}
            className="w-36 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {SEASON_OPTIONS.map((season) => (
            <div key={season.key} className="rounded-lg border border-slate-200 bg-white p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={demand[season.flag]}
                  onChange={(event) => {
                    setDemandState({ [season.flag]: event.target.checked } as Partial<typeof demand>);
                    if (event.target.checked && !demand.availableCrops[season.key]) loadCrops(season.key);
                  }}
                />
                {season.key}
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(demand.availableCrops[season.key] ?? []).map((crop) => {
                  const selected = (demand.selectedCrops[season.key] ?? []).includes(crop);
                  return (
                    <button
                      key={crop}
                      type="button"
                      onClick={() => {
                        const current = demand.selectedCrops[season.key] ?? [];
                        const next = selected ? current.filter((item) => item !== crop) : [...current, crop];
                        setDemandState({
                          selectedCrops: {
                            ...demand.selectedCrops,
                            [season.key]: next,
                          },
                        });
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {crop}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={runAgriculturalDemand}
          disabled={!demand.agriculturalChecked || demand.agriculturalLoading}
          className="mt-3 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {demand.agriculturalLoading ? "Computing..." : "Compute Agricultural"}
        </button>
        {demand.agriculturalError && (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{demand.agriculturalError}</div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">Industrial Demand</div>
        <div className="mt-3 grid gap-3">
          {demand.industrialData.map((item) => (
            <div
              key={`${item.industry}-${item.subtype}`}
              className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[1.4fr_1fr_1fr]"
            >
              <div>
                <div className="text-sm font-medium text-slate-900">{item.industry}</div>
                <div className="text-xs text-slate-500">{item.subtype}</div>
              </div>
              <input
                type="number"
                step="0.1"
                value={item.consumptionValue}
                onChange={(event) =>
                  setDemandState({
                    industrialData: demand.industrialData.map((row) =>
                      row.industry === item.industry && row.subtype === item.subtype
                        ? { ...row, consumptionValue: Number(event.target.value) }
                        : row,
                    ),
                  })
                }
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="number"
                step="0.1"
                value={item.production}
                onChange={(event) =>
                  setDemandState({
                    industrialData: demand.industrialData.map((row) =>
                      row.industry === item.industry && row.subtype === item.subtype
                        ? { ...row, production: Number(event.target.value) }
                        : row,
                    ),
                  })
                }
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={demand.industrialChecked}
              onChange={(event) => setDemandState({ industrialChecked: event.target.checked })}
            />
            Enable industrial demand
          </label>
          <input
            type="number"
            step="0.1"
            value={demand.industrialGWShare}
            onChange={(event) => setDemandState({ industrialGWShare: Number(event.target.value) })}
            className="w-36 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={runIndustrialDemand}
            disabled={!wells.csvFilename || !demand.industrialChecked || demand.industrialLoading}
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {demand.industrialLoading ? "Computing..." : "Compute Industrial"}
          </button>
        </div>
        {demand.industrialError && (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{demand.industrialError}</div>
        )}
      </div>

      <ModuleDataTable
        rows={demand.combinedData}
        emptyMessage="Demand rows will appear here after at least one demand computation."
      />
    </div>
  );
}
