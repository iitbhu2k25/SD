'use client';

import { useState } from "react";

import { fetchAdminUnitsForVillages, buildSwaQueryFromAdminSelection } from "../services/location.service";
import { useGwaStore } from "../store/gwa.store";
import { getConfirmedAreaCodes } from "../utils/helpers";

export default function ComputeAvailableWaterButton() {
  const { confirmedLocation, gsr } = useGwaStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirmedLocation || gsr.stressData.length === 0) return null;

  const handleClick = async () => {
    setLoading(true);
    setError(null);

    try {
      const params =
        confirmedLocation.mode === "admin" && confirmedLocation.admin
          ? buildSwaQueryFromAdminSelection(confirmedLocation.admin)
          : (() => {
              const { villageCodes } = getConfirmedAreaCodes(confirmedLocation);
              return fetchAdminUnitsForVillages(villageCodes).then((units) => {
                const search = new URLSearchParams();
                if (units.state_code !== null && units.state_code !== undefined) {
                  search.set("state", String(units.state_code));
                }
                if (units.district_codes.length > 0) {
                  search.set("districts", units.district_codes.join(","));
                }
                if (units.subdistrict_codes.length > 0) {
                  search.set("subdistricts", units.subdistrict_codes.join(","));
                }
                return search;
              });
            })();

      const searchParams = params instanceof URLSearchParams ? params : await params;
      localStorage.setItem("gwa_stress_data", JSON.stringify(gsr.stressData));
      window.open(`/dss/gwm/MAR/SWA?${searchParams.toString()}`, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to prepare SWA handoff");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-full bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {loading ? "Preparing..." : "Compute Available Water"}
      </button>
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
    </div>
  );
}
