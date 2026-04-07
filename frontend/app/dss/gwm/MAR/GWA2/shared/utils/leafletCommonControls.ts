type ControlOptions = {
  enableScale?: boolean;
  enableFullscreen?: boolean;
  enableCoordinates?: boolean;
};

export async function attachLeafletCommonControls(
  L: any,
  map: any,
  opts: ControlOptions = {},
): Promise<() => void> {
  const {
    enableScale = true,
    enableFullscreen = true,
    enableCoordinates = true,
  } = opts;

  const cleanups: Array<() => void> = [];

  if (enableScale) {
    const scale = L.control.scale({ position: "bottomleft", metric: true, imperial: true });
    scale.addTo(map);
    cleanups.push(() => {
      try {
        map.removeControl(scale);
      } catch {}
    });
  }

  if (enableFullscreen) {
    const fullscreenControl = L.Control.extend({
      onAdd: () => {
        const container = L.DomUtil.create("div", "leaflet-control-fullscreen");
        const button = L.DomUtil.create("button", "fullscreen-button", container) as HTMLButtonElement;

        button.style.cssText = `
          background: white;
          border: 2px solid rgba(0,0,0,0.2);
          border-radius: 4px;
          width: 30px;
          height: 30px;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 5px rgba(0,0,0,0.4);
        `;

        const updateButton = () => {
          const isFullscreen = !!document.fullscreenElement;
          button.innerHTML = isFullscreen ? "[-]" : "[ ]";
          button.title = isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen";
        };

        updateButton();
        button.onmouseover = () => {
          button.style.backgroundColor = "#f4f4f4";
        };
        button.onmouseout = () => {
          button.style.backgroundColor = "white";
        };

        L.DomEvent.on(button, "click", L.DomEvent.stopPropagation);
        L.DomEvent.on(button, "click", () => {
          const target = map.getContainer() as HTMLElement;
          if (!document.fullscreenElement) {
            target.requestFullscreen?.().catch(() => {});
          } else {
            document.exitFullscreen?.().catch(() => {});
          }
        });

        document.addEventListener("fullscreenchange", updateButton);
        (container as any).__cleanupFullscreen = () => {
          document.removeEventListener("fullscreenchange", updateButton);
        };

        return container;
      },
      onRemove: (container: any) => {
        container?.__cleanupFullscreen?.();
      },
    });

    const control = new fullscreenControl({ position: "topleft" });
    map.addControl(control);
    cleanups.push(() => {
      try {
        map.removeControl(control);
      } catch {}
    });
  }

  if (enableCoordinates) {
    const coordControl = L.control({ position: "bottomright" });
    coordControl.onAdd = () => {
      const div = L.DomUtil.create("div", "leaflet-control leaflet-bar");
      div.style.padding = "4px 8px";
      div.style.background = "rgba(255,255,255,0.95)";
      div.style.fontSize = "11px";
      div.style.fontFamily = "monospace";
      div.style.color = "#334155";
      div.innerHTML = "Lat --, Lng --";
      return div;
    };
    coordControl.addTo(map);

    const update = (event: any) => {
      const el = (coordControl as any)._container as HTMLElement | undefined;
      if (!el) return;
      el.innerHTML = `Lat ${event.latlng.lat.toFixed(5)}, Lng ${event.latlng.lng.toFixed(5)}`;
    };

    const reset = () => {
      const el = (coordControl as any)._container as HTMLElement | undefined;
      if (!el) return;
      el.innerHTML = "Lat --, Lng --";
    };

    map.on("mousemove", update);
    map.on("mouseout", reset);
    cleanups.push(() => {
      try {
        map.off("mousemove", update);
        map.off("mouseout", reset);
        map.removeControl(coordControl);
      } catch {}
    });
  }

  return () => {
    cleanups.forEach((cleanup) => cleanup());
  };
}
