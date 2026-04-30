import Map from "ol/Map";
import Select from "ol/interaction/Select";
import { doubleClick, pointerMove } from "ol/events/condition";
import { Fill, Stroke, Style } from "ol/style";

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
  style?: Style,
) {
  const interaction = new Select({
    condition: pointerMove,
    style:
      style ??
      new Style({
        stroke: new Stroke({ color: "#f59e0b", width: 3 }),
        fill: new Fill({ color: "rgba(245, 158, 11, 0.14)" }),
        zIndex: 999,
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
