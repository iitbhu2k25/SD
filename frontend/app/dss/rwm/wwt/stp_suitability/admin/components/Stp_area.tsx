import React from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { useCategory } from "@/contexts/stp_suitability/admin/CategoryContext";
import { api } from "@/services/api";
import { useLocation } from "@/contexts/stp_suitability/admin/LocationContext";
import { useMap } from "@/contexts/stp_suitability/admin/MapContext";
import { result } from "lodash";
import { toast } from "react-toastify";

type FormValues = {
  stpAreaId: number;
  customLand: number;
  mldCapacity: number;
};

export const TreatmentForm: React.FC = () => {
  const { StpArea, OptSetStpArea } = useCategory();
  const { displayRaster } = useLocation();
  const { setResultLayer, setIsMapLoading } = useMap();

  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { stpAreaId: 1, customLand: 0, mldCapacity: 20 },
  });
  const mldCapacity = useWatch({ control, name: "mldCapacity" });

  const onSubmit = async (data: FormValues) => {
    const chosen = StpArea.find((opt) => opt.id == data.stpAreaId);
    if (chosen) {
      try {

        setIsMapLoading(true);
        OptSetStpArea(chosen);

        const layer_name = displayRaster.find(
          (opt) => opt.file_name === "STP_suitability"
        )?.layer_name;

        const response = await api.post("/stp_operation/stp_suitability_area", {
          body: {
            TREATMENT_TECHNOLOGY: chosen.id,
            MLD_CAPACITY: data.mldCapacity,
            CUSTOM_LAND_PER_MLD: data.customLand,
            layer_name: layer_name,
          },
        });
        if (response.message ==false) {
          console.log("No cluster found")
          toast.error("No cluster found")
          return
        }
        toast.success("cluster found")
        setResultLayer(response.message as string);
      }
      catch (err) {
        console.log(err)
      }
      finally {
        setIsMapLoading(false);
      }

    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-3xl w-full mx-auto p-6 rounded-2xl relative overflow-hidden"
    >
      {/* Disco background */}
      <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 via-purple-600 to-blue-500 animate-[gradient_6s_linear_infinite] bg-[length:400%_400%] opacity-20"></div>

      <div className="relative z-10 bg-white/90 backdrop-blur-md shadow-2xl rounded-2xl p-6">
        <h2 className="text-2xl font-extrabold text-center mb-6 text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 via-purple-500 to-blue-500 animate-pulse">
          STP Area and Location Finder
        </h2>

        {/* 1️⃣ MLD Capacity Input */}
        <div className="mb-6">
          <label className="block text-gray-700 font-semibold mb-1">
            MLD Capacity
          </label>
          <Controller
            name="mldCapacity"
            control={control}
            rules={{
              min: { value: 1, message: "Must be ≥ 1" },
              max: { value: 200, message: "Must be ≤ 200" },
            }}
            render={({ field }) => (
              <input
                type="number"
                {...field}
                className="w-full rounded-lg border-gray-300 shadow-md focus:border-yellow-500 focus:ring focus:ring-yellow-300 focus:shadow-yellow-400/50 p-2 transition-all"
              />
            )}
          />
          {errors.mldCapacity && (
            <p className="text-red-500 text-sm mt-1">
              {errors.mldCapacity.message}
            </p>
          )}
        </div>

        {/* 2️⃣ Tech Table */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Available Technologies
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border rounded-lg overflow-hidden">
              <thead className="bg-gradient-to-r from-yellow-400 via-purple-400 to-blue-400 text-white">
                <tr>
                  <th className="px-4 py-2 text-left">Technology</th>
                  <th className="px-4 py-2 text-left">Area (ha)</th>
                </tr>
              </thead>
              <tbody>
                {StpArea.map((tech) => (
                  <tr
                    key={tech.id}
                    className="border-t hover:bg-gradient-to-r hover:from-yellow-50 hover:via-purple-50 hover:to-blue-50 transition"
                  >
                    <td className="px-4 py-2">{tech.tech_name}</td>
                    <td className="px-4 py-2">
                      {mldCapacity ? (tech.tech_value * mldCapacity).toFixed(2) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3️⃣ Choose Tech Dropdown */}
        <div className="mb-6">
          <label className="block text-gray-700 font-semibold mb-1">
            Choose Technology
          </label>
          <Controller
            name="stpAreaId"
            control={control}
            rules={{ required: "Please select a technology" }}
            render={({ field }) => (
              <select
                {...field}
                className="w-full rounded-lg border-gray-300 shadow-md focus:border-purple-500 focus:ring focus:ring-purple-300 focus:shadow-purple-400/50 p-2 transition-all"
              >
                <option value="">-- Pick one --</option>
                {StpArea.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.tech_name}
                  </option>
                ))}
              </select>
            )}
          />
          {errors.stpAreaId && (
            <p className="text-red-500 text-sm mt-1">
              {errors.stpAreaId.message}
            </p>
          )}
        </div>

        {/* 4️⃣ Custom Land Slider */}
        <div className="mb-6">
          <label className="block text-gray-700 font-semibold mb-1">
            Custom Land Area
          </label>
          <Controller
            name="customLand"
            control={control}
            rules={{
              min: { value: 0, message: "Must be ≥ 0" },
              max: { value: 2, message: "Must be ≤ 2" },
            }}
            render={({ field }) => (
              <>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.01}
                  value={field.value}
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  className="w-full accent-purple-500 cursor-pointer 
                             [&::-webkit-slider-thumb]:bg-gradient-to-r 
                             [&::-webkit-slider-thumb]:from-yellow-500 
                             [&::-webkit-slider-thumb]:to-blue-500 
                             [&::-webkit-slider-thumb]:rounded-full 
                             [&::-webkit-slider-thumb]:shadow-lg"
                />
                <div className="text-sm font-medium text-purple-600 mt-1">
                  {field.value.toFixed(2)}
                </div>
              </>
            )}
          />
          {errors.customLand && (
            <p className="text-red-500 text-sm mt-1">
              {errors.customLand.message}
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="w-full mt-4 bg-gradient-to-r from-yellow-500 via-purple-500 to-blue-500 hover:opacity-90 text-white font-bold py-2 rounded-lg shadow-lg animate-[pulse_2s_infinite] transition"
        >
          Submit
        </button>
      </div>
    </form>
  );
};
