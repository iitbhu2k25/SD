
import { useCallback, useRef, useState } from "react";
import { OperationDef } from "./registry";
import { api } from "@/services/api";


export type TaskStatus = "idle" | "submitting" | "pending" | "running" | "completed" | "failed";

export interface TaskLog {
  timestamp: string;
  message: string;
}

export interface TaskResult {
  file_id: string;
  layer_name: string;
  file_name: string;
}

export interface TaskState {
  taskId: string | null;
  status: TaskStatus;
  progress: number;          // 0–100
  logs: TaskLog[];
  result: TaskResult | null;
  error: string | null;
}


const WS_BASE  = process.env.NEXT_PUBLIC_WEBSOCKET_URL;

/** Endpoint map: operation id → POST path */
const ENDPOINT_MAP: Record<string, string> = {
  slope:              "/tools/slope",
  tpi:                "/tools/tpi",
  flow_direction:     "/tools/flow-direction",
  flow_accumulation:  "/tools/flow-accumulation",
  twi:                "/tools/twi",
  projection:         "/tools/reprojection",
  cell_resize:        "/tools/cell-resize",
  interpolation:      "/tools/interpolation",
  reclassification:   "/tools/reclassify",
  euclidean_distance: "/tools/euclidean-distance",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowISO() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function buildPayload(op: OperationDef, params: Record<string, unknown>, fileId: string, nodata: string) {
  
  const base = { file_id: fileId, src_nodata: String(nodata) };

  switch (op.id) {
    case "slope":
      return { ...base, units: params.unit };
    case "tpi":
      return { ...base, radius: params.radius };
    case "flow_direction":
      return { ...base, algorithm: params.algorithm ?? "d8", fill_depressions: params.fill_depressions ?? true };
    case "flow_accumulation":
      return { ...base, algorithm: params.algorithm ?? "d8", output_type: params.output_type ?? "cells", fill_depressions: true, log_transform: params.log_transform ?? false };
    case "twi":
      return { ...base, fill_depressions: true, algorithm: params.algorithm ?? "d8" };
    case "projection":
      return { ...base, target_epsg: params.target_crs, resampling: params.resampling };
    case "cell_resize":
      return { ...base, target_cell: params.cell_size, algorithm: params.method, dtype_override: "float32" };
    case "interpolation":
      return { ...base, method: params.method, cell_size: params.cell_size };
    case "reclassification":
      return { ...base, raster_type: "float32", rules: params.rules ?? [], num_classes: params.num_classes };
    case "euclidean_distance":
      return { ...base, distance_units: "GEO" };
    default:
      return { ...base, ...params };
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOperationTask(fileId: string, srcNodata: string = "0") {
  const [taskState, setTaskState] = useState<TaskState>({
    taskId: null,
    status: "idle",
    progress: 0,
    logs: [],
    result: null,
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);

  const addLog = (message: string) =>
    setTaskState((prev) => ({
      ...prev,
      logs: [...prev.logs, { timestamp: nowISO(), message }],
    }));

  /** Tear down any existing WebSocket cleanly */
  const closeWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  /** Step 3: fetch the final result after task completes */
  const fetchResult = useCallback(async (taskId: string) => {
    try {
      const res = await api.get(`/tools/raster/${taskId}/output`);
      if (res.status !== 201){
        console.log("error fetching result", res.status);
        return 
      }
      const data = await res.message as TaskResult;
      
      setTaskState((prev) => ({
        ...prev,
        status: "completed",
        progress: 100,
        result: data,
      }));
      addLog("Output ready");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setTaskState((prev) => ({ ...prev, status: "failed", error: msg }));
      addLog(`Failed to fetch result: ${msg}`);
    }
  }, []);

  /** Step 2: open WebSocket and listen for task events */
  const openWebSocket = useCallback(
    (taskId: string) => {
      closeWs();
      const ws = new WebSocket(`${WS_BASE}/tools/ws/operation/${taskId}`);
      wsRef.current = ws;
      ws.onopen = () => addLog("Connected to task stream");

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            status?: string;
            progress?: number;
            message?: string;
            error?: string;
          };

          if (msg.message) addLog(msg.message);

          if (msg.progress !== undefined) {
            setTaskState((prev) => ({ ...prev, progress: msg.progress! }));
          }

          if (msg.status) {
            const status = msg.status.toLowerCase() as TaskStatus;
            setTaskState((prev) => ({ ...prev, status }));

            if (status === "completed") {
              closeWs();
              fetchResult(taskId);
            } else if (status === "failed") {
              closeWs();
              setTaskState((prev) => ({
                ...prev,
                status: "failed",
                error: msg.error ?? "Task failed on the server",
              }));
            }
          }
        } catch {
          
        }
      };

      ws.onerror = () => {
        addLog("WebSocket error — retrying via polling…");
        closeWs();
      };

      ws.onclose = (e) => {
        if (!e.wasClean) addLog("WebSocket closed unexpectedly");
      };
    },
    [closeWs, fetchResult]
  );


  /** Step 1: submit operation to the API */
  const execute = useCallback(
    async (op: OperationDef, params: Record<string, unknown>) => {
      closeWs();
      setTaskState({
        taskId: null,
        status: "submitting",
        progress: 0,
        logs: [{ timestamp: nowISO(), message: `Submitting ${op.label}…` }],
        result: null,
        error: null,
      });

      const endpoint = op.apiEndpoint ?? ENDPOINT_MAP[op.id] ?? `/tools/${op.id}`;
      const payload = buildPayload(op, params, fileId, srcNodata);

      try {
        const res = await api.post(`${endpoint}`,{
            body:payload
        })

        if (res.status!=201) {
          console.log("error in placing the api call")
          return 
        }
        const task_id =await res.message as string
        setTaskState((prev) => ({
          ...prev,
          taskId: task_id,
          status: "pending",
          logs: [...prev.logs, { timestamp: nowISO(), message: `Task created: ${task_id}` }],
        }));

        openWebSocket(task_id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setTaskState((prev) => ({
          ...prev,
          status: "failed",
          error: msg,
          logs: [...prev.logs, { timestamp: nowISO(), message: `Error: ${msg}` }],
        }));
      }
    },
    [fileId, srcNodata, closeWs, openWebSocket]
  );

  /** Allow re-running from the task panel */
  const reset = useCallback(() => {
    closeWs();
    setTaskState({ taskId: null, status: "idle", progress: 0, logs: [], result: null, error: null });
  }, [closeWs]);

  return { taskState, execute, reset };
}