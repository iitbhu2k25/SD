import { useCallback, useRef } from "react";
import { OperationDef } from "./registry";
import { api, ApiError } from "@/services/api";
import {
  TaskStatus,
  TaskResult,
  TaskState,
} from "@/interface/raster_operations";
import { toast } from "react-toastify";


export const INITIAL_TASK_STATE: TaskState = {
  taskId: null,
  status: "idle",
  progress: 0,
  logs: [],
  result: null,
  error: null,
};

const WS_BASE = process.env.NEXT_PUBLIC_WEBSOCKET_URL;

/** Endpoint map: operation id → POST path */
const ENDPOINT_MAP: Record<string, string> = {
  slope: "/tools/slope",
  tpi: "/tools/tpi",
  flow_direction: "/tools/flow_direction",
  flow_accumulation: "/tools/flow_accumulation",
  twi: "/tools/twi",
  projection: "/tools/reprojection",
  cell_resize: "/tools/raster_resolution_execute",
  interpolation: "/tools/interpolation",
  reclassification: "/tools/reclassify",
  euclidean_distance: "/tools/euclidean-distance",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowISO() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function buildPayload(
  op: OperationDef,
  params: Record<string, unknown>,
  fileId: string,
  nodata: string,
) {
  const base = { file_id: fileId, src_nodata: String(nodata) };

  switch (op.id) {
    case "slope":
      return { ...base, units: params.unit };
    case "tpi":
      return { ...base, radius: params.radius };
    case "flow_direction":
      return {
        ...base,
        algorithm: params.algorithm,
        fill_depressions: params.fill_depressions,
      };
    case "flow_accumulation":
      return {
        ...base,
        algorithm: params.algorithm,
        output_type: params.output_type,
        fill_depressions: true,
        log_transform: params.log_transform,
      };
    case "twi":
      return {
        ...base,
        fill_depressions: params.fill_depressions,
        algorithm: params.algorithm,
      };
    case "projection":
      return {
        ...base,
        target_epsg: params.target_crs,
        resampling: params.resampling,
      };
    case "cell_resize":
      return {
        ...base,
        target_cell: params.cell_size,
        algorithm: params.method,
        dtype_override: "float32",
      };
    case "interpolation":
      return {
        file_id: fileId,
        z_field: params.z_field,
        algorithm: params.algorithm,
        ...(params.xmin != null && {
          xmin: params.xmin,
          xmax: params.xmax,
          ymin: params.ymin,
          ymax: params.ymax,
        }),
      };
    case "reclassification":
      return {
        ...base,
        raster_type: "float32",
        method: params.method,
        classes: params.num_classes,
      };
    case "euclidean_distance":
      return {
        file_id: fileId,
        ...(params.xmin != null && {
          xmin: params.xmin,
          xmax: params.xmax,
          ymin: params.ymin,
          ymax: params.ymax,
        }),
      };
    default:
      return { ...base, ...params };
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOperationTask(
  fileId: string,
  srcNodata: string = "0",
  setTaskState: React.Dispatch<React.SetStateAction<TaskState>>,
) {
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
  const fetchResult = useCallback(
    async (taskId: string) => {
      try {
        const res = await api.get(`/tools/raster/${taskId}/output`);
        if (res.status !== 201) {
          console.log("error fetching result", res.status);
          return;
        }
        const data = (await res.message) as TaskResult;

        setTaskState((prev) => ({
          ...prev,
          status: "completed",
          progress: 100,
          result: data,
        }));

        addLog("Output ready");
      } catch (err: unknown) {
        const msg =
          err instanceof ApiError
            ? err.message 
            : "Unknown error";
        toast.error(msg);
        setTaskState((prev) => ({ ...prev, status: "failed", error: msg }));
        addLog(`Failed to fetch result: ${msg}`);
      }
    },
    [setTaskState],
  );

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
          // ignore malformed messages
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
    [closeWs, fetchResult, setTaskState],
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

      const endpoint =
        op.apiEndpoint ?? ENDPOINT_MAP[op.id] ?? `/tools/${op.id}`;
      const payload = buildPayload(op, params, fileId, srcNodata);

      // ── Dry-run check for cell_resize ─────────────────────────────────────
      if (op.id === "cell_resize") {
        try {
          addLog("Running dry-run check…");
          const dryRes = await api.post("/tools/raster_resolution", { body: payload });
          const dryData = dryRes.message as {
            is_safe: boolean;
            warnings?: string[];
            output_size_gb?: number;
            scale_factor?: number;
            operation?: string;
            recommendation?: string;
          };

          if (dryData.warnings && dryData.warnings.length > 0) {
            dryData.warnings.forEach((w) => addLog(`⚠ ${w}`));
          }

          if (!dryData.is_safe) {
            const recommendation = dryData.recommendation ?? "Operation is not safe to execute.";
            addLog(`Blocked: ${recommendation}`);
            toast.error(`Cell Resize blocked: ${recommendation}`);
            setTaskState((prev) => ({
              ...prev,
              status: "failed",
              error: recommendation,
            }));
            return;
          }

          addLog("Dry-run passed — proceeding with execution…");
        } catch (err: unknown) {
          const msg = err instanceof ApiError ? err.message : "Dry-run check failed";
          toast.error(msg);
          setTaskState((prev) => ({
            ...prev,
            status: "failed",
            error: msg,
            logs: [...prev.logs, { timestamp: nowISO(), message: `Dry-run error: ${msg}` }],
          }));
          return;
        }
      }

      try {
        const res = await api.post(`${endpoint}`, { body: payload });
        const task_id = (await res.message) as string;

        setTaskState((prev) => ({
          ...prev,
          taskId: task_id,
          status: "pending",
          logs: [
            ...prev.logs,
            { timestamp: nowISO(), message: `Task created: ${task_id}` },
          ],
        }));

        openWebSocket(task_id);
      } catch (err: unknown) {
        const msg =
          err instanceof ApiError
            ? err.message 
            : "Unknown error";

        toast.error(msg);

        setTaskState((prev) => ({
          ...prev,
          status: "failed",
          error: msg,
          logs: [
            ...prev.logs,
            { timestamp: nowISO(), message: `Error: ${msg}` },
          ],
        }));
      }
    },
    [fileId, srcNodata, closeWs, openWebSocket, setTaskState],
  );

  /** Allow re-running from the task panel */
  const reset = useCallback(() => {
    closeWs();
    setTaskState(INITIAL_TASK_STATE);
  }, [closeWs, setTaskState]);

  return { execute, reset };
}
