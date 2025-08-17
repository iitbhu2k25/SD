import React from "react";
import { useForm, Controller } from "react-hook-form";
import { useCategory } from "@/contexts/stp_sutability/admin/CategoryContext";
import { api } from "@/services/api";
import { useLocation } from "@/contexts/stp_sutability/admin/LocationContext";
import { useMap } from "@/contexts/stp_sutability/admin/MapContext";

type FormValues = {
  stpAreaId: number;
  customLand: number;
  mldCapacity: number;
};

export const TreatmentForm: React.FC = () => {
  const { StpArea, OptSetStpArea } = useCategory();
  const {displayRaster} = useLocation();
  const {setSecondaryLayer,setIsMapLoading}=useMap();
  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { stpAreaId: 1, customLand: 0, mldCapacity: 20 },
  });

  const onSubmit = async (data: FormValues) => {
    
    const chosen = StpArea.find((opt) => 
        opt.id == data.stpAreaId);
    if (chosen) {
      setIsMapLoading(true);
      OptSetStpArea(chosen);
      console.log({
        tech: chosen.id,
        mldCapacity: data.mldCapacity,
        customLand: data.customLand,
      });
      const layer_name=displayRaster.find((opt) =>
        opt.file_name==="STP_Sutability")?.layer_name;
      console.log(layer_name);
      const response =await api.post("/stp_operation/stp_sutability_area",{
        body:{
        TREATMENT_TECHNOLOGY: chosen.id,
        MLD_CAPACITY: data.mldCapacity,
        CUSTOM_LAND_PER_MLD: data.customLand,
        layer_name:layer_name
        }
      })
      setSecondaryLayer(response.message as string)
      setIsMapLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-3xl w-full mx-auto bg-white shadow-lg rounded-2xl p-6"
    >
      <h2 className="text-xl font-semibold text-gray-800 text-center mb-4">
        Treatment Form
      </h2>

      {/* Table-style layout */}
      <div className="grid grid-cols-3 gap-6 text-center font-medium text-gray-700 border-b pb-2">
        <span>Treatment Tech</span>
        <span>MLD Capacity</span>
        <span>Custom Land (per MLD)</span>
      </div>

      <div className="grid grid-cols-3 gap-6 items-start mt-4">
        {/* Technology Select */}
        <div>
          <Controller
            name="stpAreaId"
            control={control}
            rules={{ required: "Please select a technology" }}
            render={({ field }) => (
              <select
                {...field}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 p-2"
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

        {/* MLD Capacity Number Input */}
        <div>
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
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring focus:ring-green-200 p-2"
              />
            )}
          />
          {errors.mldCapacity && (
            <p className="text-red-500 text-sm mt-1">
              {errors.mldCapacity.message}
            </p>
          )}
        </div>

        {/* Custom Land Slider */}
        <div>
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
                  className="w-full accent-blue-600"
                />
                <div className="text-sm text-gray-600 mt-1">
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
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg shadow-md transition"
      >
        Submit
      </button>
    </form>
  );
};
