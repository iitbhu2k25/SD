'use client'
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { api, ApiError } from '@/services/api';
import { toast } from 'react-toastify';
import { useWebSocket } from '@/services/websocket';
import { ClipRasters } from '@/interface/raster_context';

const WS_BASE = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
interface STP_area_final{
  cluster_layer:string|null
  suitable_path:string | null

}
interface STPAreaContextType {
  findSTPArea: (treatmentTech: number, mldCapacity: number) => Promise<void>
  stpAreaLoading: boolean
  stpAreaResult: any | null
  setSTPAreaParams: (rasterLayerInfo: ClipRasters | null, location: [number, number][]) => void
  rasterLayerInfo: ClipRasters | null
}

const STPAreaContext = createContext<STPAreaContextType>({
  findSTPArea: async () => {},
  stpAreaLoading: false,
  stpAreaResult: null,
  setSTPAreaParams: () => {},
  rasterLayerInfo: null,
});

export const STPAreaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [stpAreaLoading, setStpAreaLoading] = useState(false);
  const [stpAreaResult, setStpAreaResult] = useState<STP_area_final|null>(null);
  const [stpAreaWsUrl, setStpAreaWsUrl] = useState('');
  const stpAreaTaskIdRef = useRef<string | null>(null);
  const rasterLayerInfoRef = useRef<ClipRasters | null>(null);
  const locationRef = useRef<[number, number][]>([]);
  const [rasterLayerInfo, setRasterLayerInfoState] = useState<ClipRasters | null>(null);

  const { lastMessage, disconnect: disconnectStpArea } = useWebSocket(stpAreaWsUrl);

  const setSTPAreaParams = (rasterLayerInfoVal: ClipRasters | null, location: [number, number][]) => {
    rasterLayerInfoRef.current = rasterLayerInfoVal;
    locationRef.current = location;
    setRasterLayerInfoState(rasterLayerInfoVal);
  };

  const findSTPArea = async (treatmentTech: number, mldCapacity: number): Promise<void> => {
    if (!rasterLayerInfoRef.current) return;

    disconnectStpArea();
    setStpAreaWsUrl('');
    stpAreaTaskIdRef.current = null;
    setStpAreaLoading(true);

    try {
      const resp = await api.post('/stp_operation/stp_suitability_area', {
        body: {
          treatment_technology: treatmentTech,
          mld_capacity: mldCapacity,
          custom_land_per_mld: 2,
          layer_name: rasterLayerInfoRef.current.layer_name,
          location: locationRef.current,
        },
      });
      const taskId = (resp.message as { task_id: string }).task_id;
      stpAreaTaskIdRef.current = taskId;
      setStpAreaWsUrl(`${WS_BASE}/tools/ws/operation/${taskId}`);
    } catch (error: any) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
      setStpAreaLoading(false);
    }
  };

  useEffect(() => {
    if (!lastMessage) return;
    try {
      const msg = JSON.parse(lastMessage) as {
        status?: string;
        description?: string;
      };

      if (msg.status === 'completed') {
        disconnectStpArea();
        setStpAreaWsUrl('');
        const taskId = stpAreaTaskIdRef.current;
        if (taskId) {
          api.get(`/stp_operation/stp_area/${taskId}`)
            .then((res) => {
              const result = res.message as STP_area_final;
              if (result.cluster_layer){
                toast.success('cluster layer found');
              }
              else{
                toast.error('cluster layer not found');
              }
              if (result.suitable_path){
                toast.success('suitable path found');
              }
              else{
                toast.error('suitable path not found');
              }
              setStpAreaResult(result);
            })
            .catch(() => {
              toast.error('Failed to fetch area result');
            })
            .finally(() => setStpAreaLoading(false));
        } else {
          setStpAreaLoading(false);
        }
      } else if (msg.status === 'failed') {
        disconnectStpArea();
        setStpAreaWsUrl('');
        setStpAreaLoading(false);
        toast.error(msg.description ?? 'STP area analysis failed');
      }
    } catch {
      // ignore malformed messages
    }
  }, [lastMessage, disconnectStpArea]);

  return (
    <STPAreaContext.Provider value={{ findSTPArea, stpAreaLoading, stpAreaResult, setSTPAreaParams, rasterLayerInfo }}>
      {children}
    </STPAreaContext.Provider>
  );
};

export const useSTPArea = (): STPAreaContextType => {
  const context = useContext(STPAreaContext);
  if (context === undefined) {
    throw new Error('useSTPArea must be used within a STPAreaProvider');
  }
  return context;
};
