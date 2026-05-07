import Map from "ol/Map";
import Select from "ol/interaction/Select";
import { doubleClick, pointerMove } from "ol/events/condition";
import { Circle, Fill, Stroke, Style } from "ol/style";

type SelectHandler = (event: any, interaction: Select) => void;
type LayerFilter = (feature: any, layer: any) => boolean;

export function createDoubleClickSelectInteraction(
  onSelect: SelectHandler,
  filter?: LayerFilter,
) {
  const interaction = new Select({
    condition: doubleClick,
    style: new Style({
      stroke: new Stroke({ color: "#ff0000", width: 3 }),
      fill: new Fill({ color: "rgba(255, 0, 0, 0.3)" }),
    }),
    ...(filter ? { filter } : {}),
  });

  interaction.on("select", (event) => onSelect(event, interaction));
  return interaction;
}

export function createHoverSelectInteraction(
  onHover: SelectHandler,
  filter?: LayerFilter,
  style?: any,
) {
  const interaction = new Select({
    condition: pointerMove,
    style:
      style ??
      ((feature: any) => {
        const geometryType = feature.getGeometry()?.getType();

        if (geometryType === "Point" || geometryType === "MultiPoint") {
          const location = String(feature.get("Location") || "");
          const wqiClass = feature.get("WQI_Class");
          let color = "#3b82f6";
          if (location.includes("Drain")) color = "#f472b6";
          else if (location.includes("Upstream")) color = "#3b82f6";
          else if (location.includes("Downstream")) color = "#84cc16";
          else if (wqiClass === "Excellent") color = "#22c55e";
          else if (wqiClass === "Good") color = "#84cc16";
          else if (wqiClass === "Poor") color = "#f97316";
          else if (wqiClass === "Very Poor") color = "#ef4444";

          return new Style({
            image: new Circle({
              radius: 13,
              fill: new Fill({ color }),
              stroke: new Stroke({ color: "#ffffff", width: 3 }),
            }),
            zIndex: 999,
          });
        }

        return new Style({
          stroke: new Stroke({ color: "#f59e0b", width: 3 }),
          fill: new Fill({ color: "transparent" }),
          zIndex: 999,
        });
      }),
    ...(filter ? { filter } : {}),
  });

  interaction.on("select", (event) => onHover(event, interaction));
  return interaction;
}

export function attachPointerMoveTracker(
  map: Map,
  setMousePosition: (position: { x: number; y: number }) => void,
) {
  const handleMouseMove = (event: any) => {
    setMousePosition({
      x: event.pixel[0],
      y: event.pixel[1],
    });
  };

  map.on("pointermove", handleMouseMove);
  return () => map.un("pointermove", handleMouseMove);
}

export function attachFullscreenChangeListener(
  setIsFullScreen: (isFullScreen: boolean) => void,
) {
  const handleFullScreenChange = () => {
    setIsFullScreen(!!document.fullscreenElement);
  };

  document.addEventListener("fullscreenchange", handleFullScreenChange);
  return () => {
    document.removeEventListener("fullscreenchange", handleFullScreenChange);
  };
}

export function toggleBrowserFullscreen(
  container: HTMLElement | null,
  isFullScreen: boolean,
) {
  if (!container) {
    return;
  }

  if (!isFullScreen) {
    container.requestFullscreen?.();
    return;
  }

  document.exitFullscreen?.();
}
