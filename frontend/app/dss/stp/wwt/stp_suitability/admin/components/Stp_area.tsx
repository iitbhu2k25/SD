import React, { useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { useCategory } from "@/contexts/stp_suitability/admin/CategoryContext";
import { api } from "@/services/api";
import { useLocation } from "@/contexts/stp_suitability/admin/LocationContext";
import { useMap } from "@/contexts/stp_suitability/admin/MapContext";
import { useSTPStore } from "@/store/useSTPStore";
import { toast } from "react-toastify";
import { MapPin, Layers, Sliders, ChevronDown, Loader2, CheckCircle2 } from "lucide-react";

type FormValues = {
  stpAreaId: number;
  customLand: number;
  mldCapacity: number;
};

export const TreatmentForm: React.FC = () => {
  const { StpArea, OptSetStpArea } = useCategory();
  const { displayRaster } = useLocation();
  const { setResultLayer, setIsMapLoading } = useMap();
  const Q = useSTPStore(s => s.Q);
  const setParams = useSTPStore(s => s.setParams);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { stpAreaId: 1, customLand: 0, mldCapacity: Q },
  });

  const mldCapacity = useWatch({ control, name: "mldCapacity" });
  const customLand  = useWatch({ control, name: "customLand" });

  const onSubmit = async (data: FormValues) => {
    const chosen = StpArea.find((opt) => opt.id == data.stpAreaId);
    if (!chosen) return;

    try {
      setSubmitting(true);
      setSuccess(false);
      setIsMapLoading(true);
      OptSetStpArea(chosen);

      const layer_name = displayRaster.find(
        (opt) => opt.file_name === "STP_Suitability"
      )?.layer_name;

      const response = await api.post("/stp_operation/stp_suitability_area", {
        body: {
          TREATMENT_TECHNOLOGY: chosen.id,
          MLD_CAPACITY: data.mldCapacity,
          CUSTOM_LAND_PER_MLD: data.customLand,
          layer_name,
        },
      });

      if (response.status === 204) {
        toast.error("No cluster found");
        return;
      }

      setSuccess(true);
      toast.success("Cluster found");
      setResultLayer(response.message as string);
    } catch (err) {
      toast.error("Unknown internal error");
      console.error(err);
    } finally {
      setSubmitting(false);
      setIsMapLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
            <MapPin className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white leading-tight">
              STP Area &amp; Location Finder
            </h2>
            <p className="text-xs text-teal-100 mt-0.5">
              Configure capacity and technology to identify suitable clusters
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">

          {/* ── MLD Capacity ──────────────────────────────────────────── */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
              <Layers className="h-4 w-4 text-teal-600" />
              MLD Capacity
            </label>
            <Controller
              name="mldCapacity"
              control={control}
              rules={{
                min: { value: 1,   message: "Must be ≥ 1"   },
                max: { value: 200, message: "Must be ≤ 200" },
              }}
              render={({ field }) => (
                <div className="relative">
                  <input
                    type="number"
                    {...field}
                    onChange={e => {
                      field.onChange(e);
                      setParams({ Q: parseFloat(e.target.value) || Q });
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 pr-14 text-sm text-gray-900 shadow-sm outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                    MLD
                  </span>
                </div>
              )}
            />
            {errors.mldCapacity && (
              <p className="mt-1 text-xs text-red-500">{errors.mldCapacity.message}</p>
            )}
          </div>

          {/* ── Technology Table ──────────────────────────────────────── */}
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
              <Layers className="h-4 w-4 text-teal-600" />
              Available Technologies
              <span className="ml-auto text-xs font-normal text-gray-400">
                Area = tech_value × MLD
              </span>
            </p>
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-2.5">Technology</th>
                    <th className="px-4 py-2.5 text-right">Land Required (ha)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {StpArea.map((tech) => (
                    <tr
                      key={tech.id}
                      className="transition hover:bg-teal-50/60"
                    >
                      <td className="px-4 py-2.5 font-medium text-gray-800">
                        {tech.tech_name}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">
                        {mldCapacity
                          ? (tech.tech_value * mldCapacity).toFixed(2)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Choose Technology ─────────────────────────────────────── */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
              <Layers className="h-4 w-4 text-teal-600" />
              Choose Technology
            </label>
            <Controller
              name="stpAreaId"
              control={control}
              rules={{ required: "Please select a technology" }}
              render={({ field }) => (
                <div className="relative">
                  <select
                    {...field}
                    className="w-full appearance-none rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 pr-8 text-sm text-gray-900 shadow-sm outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                  >
                    <option value="">— Select a technology —</option>
                    {StpArea.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.tech_name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              )}
            />
            {errors.stpAreaId && (
              <p className="mt-1 text-xs text-red-500">{errors.stpAreaId.message}</p>
            )}
          </div>

          {/* ── Custom Land Slider ────────────────────────────────────── */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
              <Sliders className="h-4 w-4 text-teal-600" />
              Custom Land Area
              <span className="ml-auto font-semibold text-teal-700 tabular-nums">
                {Number(customLand).toFixed(2)} ha/MLD
              </span>
            </label>
            <Controller
              name="customLand"
              control={control}
              rules={{
                min: { value: 0, message: "Must be ≥ 0" },
                max: { value: 2, message: "Must be ≤ 2" },
              }}
              render={({ field }) => (
                <div className="space-y-1">
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.01}
                    value={field.value}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                    className="w-full h-2 cursor-pointer appearance-none rounded-full bg-gray-200
                               [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
                               [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
                               [&::-webkit-slider-thumb]:bg-teal-600 [&::-webkit-slider-thumb]:shadow-md
                               [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110
                               accent-teal-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>0</span>
                    <span>1</span>
                    <span>2</span>
                  </div>
                </div>
              )}
            />
            {errors.customLand && (
              <p className="mt-1 text-xs text-red-500">{errors.customLand.message}</p>
            )}
          </div>

          {/* ── Submit ────────────────────────────────────────────────── */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Finding clusters…
              </>
            ) : success ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Cluster found — run again?
              </>
            ) : (
              <>
                <MapPin className="h-4 w-4" />
                Find Suitable Locations
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};