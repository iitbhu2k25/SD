'use client'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface IndCatchmentMapProps {
  className?: string
  selectedVillages: string[]
  onLoadingChange?: (isLoading: boolean) => void
  onWatershedSelected: (watershedData: any, point: { lat: number; lng: number }) => void
  onVillagesLoaded: (villages: any[], totalPopulation: number) => void
  onVillageClick: (vlcode: string) => void
  onClearMap: () => void
  persistedData?: any
}

const IndCatchmentMap: React.FC<IndCatchmentMapProps> = ({
  className = '',
  selectedVillages,
  onLoadingChange,
  onWatershedSelected,
  onVillagesLoaded,
  onVillageClick,
  onClearMap,
}) => {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)        // for fullscreen
  const watershedLayerRef = useRef<L.GeoJSON | null>(null)
  const villagesLayerRef = useRef<L.GeoJSON | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  /** Permanent base WFS layer – state boundaries, never cleared */
  const stateLayerRef = useRef<L.GeoJSON | null>(null)
  /** Set to false when the component unmounts so in-flight async ops bail out */
  const mountedRef = useRef(true)

  const [isFetching, setIsFetching] = useState(false)
  const [fetchingVillages, setFetchingVillages] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [isLayerDropdownOpen, setIsLayerDropdownOpen] = useState(false)
  const [layerState, setLayerState] = useState({
    watershed: false,
    villages: false,
    marker: false,
  })

  // ── New state ─────────────────────────────────────────────────────────────
  /** When false the map click handler does nothing (no watershed fetch) */
  const [fetchEnabled, setFetchEnabled] = useState(true)
  /** Live cursor coordinates */
  const [cursorLatLng, setCursorLatLng] = useState<{ lat: number; lng: number } | null>(null)
  /** Whether the wrapper is in fullscreen */
  const [isFullscreen, setIsFullscreen] = useState(false)

  // ── Keep refs to callbacks so event listeners always call latest version ──

  const selectedVillagesRef = useRef<string[]>(selectedVillages)
  useEffect(() => { selectedVillagesRef.current = selectedVillages }, [selectedVillages])

  const onVillageClickRef = useRef(onVillageClick)
  useEffect(() => { onVillageClickRef.current = onVillageClick }, [onVillageClick])

  const onWatershedSelectedRef = useRef(onWatershedSelected)
  useEffect(() => { onWatershedSelectedRef.current = onWatershedSelected }, [onWatershedSelected])

  const onVillagesLoadedRef = useRef(onVillagesLoaded)
  useEffect(() => { onVillagesLoadedRef.current = onVillagesLoaded }, [onVillagesLoaded])

  const fetchEnabledRef = useRef(fetchEnabled)
  useEffect(() => { fetchEnabledRef.current = fetchEnabled }, [fetchEnabled])

  // ── Style helpers ─────────────────────────────────────────────────────────

  const getVillageStyle = useCallback((vlcode: string) => {
    const isSelected = selectedVillagesRef.current.includes(vlcode)
    return {
      color: isSelected ? '#460394' : '#069cca',
      weight: isSelected ? 1 : 2,
      opacity: isSelected ? 1 : 3,
      fillColor: isSelected ? '#08a508' : '#ee0505',
      fillOpacity: isSelected ? 10 : 10,
    }
  }, [])

  // ── Re-style villages whenever selectedVillages changes ──────────────────

  useEffect(() => {
    if (!villagesLayerRef.current) return
    villagesLayerRef.current.eachLayer((layer: any) => {
      const vlcode = layer?.feature?.properties?.vlcode
      if (vlcode) layer.setStyle(getVillageStyle(vlcode))
    })
  }, [selectedVillages, getVillageStyle])

  // ── Update layer state tracker ────────────────────────────────────────────

  const syncLayerState = useCallback(() => {
    setLayerState({
      watershed: !!(watershedLayerRef.current && mapRef.current?.hasLayer(watershedLayerRef.current)),
      villages: !!(villagesLayerRef.current && mapRef.current?.hasLayer(villagesLayerRef.current)),
      marker: !!(markerRef.current && mapRef.current?.hasLayer(markerRef.current)),
    })
  }, [])

  // ── Remove all existing layers ────────────────────────────────────────────

  const clearAllLayers = useCallback(() => {
    if (!mapRef.current) return
    if (watershedLayerRef.current) {
      mapRef.current.removeLayer(watershedLayerRef.current)
      watershedLayerRef.current = null
    }
    if (villagesLayerRef.current) {
      mapRef.current.removeLayer(villagesLayerRef.current)
      villagesLayerRef.current = null
    }
    if (markerRef.current) {
      mapRef.current.removeLayer(markerRef.current)
      markerRef.current = null
    }
    setError(null)
    syncLayerState()
  }, [syncLayerState])

  // ── Fetch villages ────────────────────────────────────────────────────────

  const fetchVillagesSpatial = useCallback(async (watershedGeoJSON: any) => {
    if (!mountedRef.current || !mapRef.current) return
    setFetchingVillages(true)
    setError(null)

    if (villagesLayerRef.current) {
      mapRef.current?.removeLayer(villagesLayerRef.current)
      villagesLayerRef.current = null
    }

    try {
      const response = await fetch('http://localhost:8050/basic/village-intersection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(watershedGeoJSON),
      })

      // Bail if component unmounted or map destroyed while waiting for response
      if (!mountedRef.current || !mapRef.current) return

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()

      // Guard again after the second async boundary (.json() is also async)
      if (!mountedRef.current || !mapRef.current) return

      if (data.success && Array.isArray(data.villages) && data.villages.length > 0) {
        const features: GeoJSON.Feature[] = data.villages
          .filter((v: any) => v.geometry)
          .map((v: any) => ({
            type: 'Feature' as const,
            geometry: v.geometry,
            properties: {
              vlcode: v.vlcode ?? v.village_code ?? '',
              village: v.village ?? v.village_name ?? 'Unknown',
              population: v.total_popu ?? v.population ?? v.total_population ?? 0,
              subdis_cod: v.subdis_cod ?? v.subdistrict_code ?? '',
            },
          }))

        const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features }

        // Build layer object WITHOUT calling .addTo() yet
        const villagesLayer = L.geoJSON(fc, {
          style: (feature) => getVillageStyle(feature?.properties?.vlcode ?? ''),
          onEachFeature: (feature, layer) => {
            const { vlcode, village, population } = feature.properties

            layer.bindPopup(`
              <div>
                <b>${village}</b><br/>
                <small>Code: ${vlcode}</small>
                ${population > 0 ? `<br/><small>Population: ${Number(population).toLocaleString()}</small>` : ''}
              </div>
            `)

            layer.on('click', (e: any) => {
              L.DomEvent.stopPropagation(e)
              onVillageClickRef.current(vlcode)
            })

            layer.on('add', () => {
              const path = (layer as any)._path
              if (path) path.style.cursor = 'pointer'
            })
          },
        })

        // Final guard right before touching the live map DOM
        if (!mountedRef.current || !mapRef.current) return

        villagesLayer.addTo(mapRef.current)
        villagesLayerRef.current = villagesLayer
        syncLayerState()

        const normalised = data.villages.map((v: any) => ({
          vlcode: v.vlcode ?? v.village_code ?? '',
          village: v.village ?? v.village_name ?? 'Unknown',
          population: v.total_popu ?? v.population ?? v.total_population ?? 0,
          subdis_cod: v.subdis_cod ?? v.subdistrict_code ?? '',
          geometry: v.geometry,
        }))

        onVillagesLoadedRef.current(normalised, data.total_population ?? 0)
      } else {
        onVillagesLoadedRef.current([], 0)
      }
    } catch (err) {
      if (!mountedRef.current) return   // swallow stale errors after unmount
      console.error('Village spatial query error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch villages')
      onVillagesLoadedRef.current([], 0)
    } finally {
      if (mountedRef.current) setFetchingVillages(false)
    }
  }, [getVillageStyle, syncLayerState])

  // ── Fetch watershed ───────────────────────────────────────────────────────

  const fetchWatershed = useCallback(async (lat: number, lng: number) => {
    if (!mountedRef.current || !mapRef.current) return

    setIsFetching(true)
    setFetchEnabled(false)   // auto-disable after fetch starts
    setError(null)
    clearAllLayers()

    try {
      const url = `https://mghydro.com/app/watershed_api?task=watershed&lat=${lat.toFixed(3)}&lng=${lng.toFixed(3)}&precision=low&source=merit`
      const response = await fetch(url)

      // Guard after first async boundary
      if (!mountedRef.current || !mapRef.current) return

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()

      // Guard after second async boundary
      if (!mountedRef.current || !mapRef.current) return

      console.log('Watershed API response:', data)

      if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features) || data.features.length === 0) {
        throw new Error('No watershed data returned for this location. Try a different point.')
      }

      const customIcon = L.divIcon({
        className: '',
        html: `<div style="
          background-color:#ef4444;
          width:14px;height:14px;
          border-radius:50%;
          border:2px solid white;
          box-shadow:0 2px 6px rgba(0,0,0,0.4);
        "></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })

      // One last guard right before all the DOM mutations
      if (!mountedRef.current || !mapRef.current) return

      markerRef.current = L.marker([lat, lng], { icon: customIcon })
        .addTo(mapRef.current)
        .bindPopup(`<b>Selected Point</b><br/>Lat: ${lat.toFixed(5)}<br/>Lng: ${lng.toFixed(5)}`)
        .openPopup()

      const watershedLayer = L.geoJSON(data, {
        style: {
          color: '#800909',
          weight: 3,
         
          fill: false,             // hollow – no fill at all
          fillOpacity: 0,
        },
      }).addTo(mapRef.current)

      watershedLayerRef.current = watershedLayer
      syncLayerState()

      const bounds = watershedLayer.getBounds()
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [50, 50] })
      }

      const firstFeature = data.features[0]
      const watershedInfo = {
        features: data.features.length,
        geometryType: firstFeature?.geometry?.type ?? 'Unknown',
        properties: firstFeature?.properties ?? {},
      }
      onWatershedSelectedRef.current(watershedInfo, { lat, lng })

      await fetchVillagesSpatial(data)
    } catch (err) {
      if (!mountedRef.current) return
      console.error('Watershed fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch watershed')
      clearAllLayers()
    } finally {
      if (mountedRef.current) setIsFetching(false)
    }
  }, [clearAllLayers, fetchVillagesSpatial, syncLayerState])

  // ── Initialise Leaflet map (runs once) ────────────────────────────────────
  // Guard against React StrictMode double-invoke: the cleanup nulls mapRef,
  // so on the second mount we must re-initialise even if the container div
  // already exists.  We use a local `cancelled` flag so the whenReady
  // callback doesn't fire for the torn-down instance.

  useEffect(() => {
    if (!mapContainerRef.current) return

    // If a stale Leaflet map is attached to the container (StrictMode teardown
    // left it partially cleaned up), destroy it first.
    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
    }

    let cancelled = false
    mountedRef.current = true   // reset in case StrictMode ran cleanup

    const map = L.map(mapContainerRef.current, {
      center: [20.5937, 78.9629],
      zoom: 5,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    mapRef.current = map

    // ── Permanent state-boundary base layer (WFS) ──────────────────────────
    // Fetched once at map init and never removed by clearAllLayers so it
    // always stays visible regardless of watershed / village operations.
    const WFS_URL =
      '/geoserver/api/myworkspace/wfs?service=WFS&version=2.0.0' +
      '&request=GetFeature&typeName=myworkspace:B_State&outputFormat=application/json'

    fetch(WFS_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`WFS HTTP ${res.status}`)
        return res.json()
      })
      .then((geojson) => {
        if (cancelled) return                     // map was torn down
        const stateLayer = L.geoJSON(geojson, {
          style: {
            color: '#0549b6',
            weight: 1.5,
            opacity: 0.7,
            fill: false,             // hollow – no fill at all
            fillOpacity: 0,
            dashArray: '4 3',
          },
          onEachFeature: (feature, layer) => {
            const name =
              feature.properties?.state_name ??
              feature.properties?.STATE_NAME ??
              feature.properties?.name ??
              ''
            if (name) layer.bindTooltip(name, { sticky: true, className: 'text-xs' })

            // Force the SVG path element to have no fill at all – Leaflet's
            // renderer can still write a fill-opacity style that shows a faint
            // tint, so we stamp fill="none" directly on the DOM node.
            const forceHollow = () => {
              const path = (layer as any)._path as SVGPathElement | undefined
              if (path) {
                path.setAttribute('fill', 'none')
                path.style.fill = 'none'
                path.style.fillOpacity = '0'
              }
            }
            layer.on('add', forceHollow)
            // Also apply immediately in case the layer is already in the DOM
            forceHollow()
          },
        }).addTo(map)
        stateLayer.bringToBack()
        stateLayerRef.current = stateLayer
      })
      .catch((err) => {
        // Non-fatal: base layer failure should not block the rest of the map
        console.warn('State WFS base layer failed to load:', err)
      })

    map.whenReady(() => {
      if (cancelled) return
      setMapReady(true)
      onLoadingChange?.(false)
    })

    return () => {
      cancelled = true
      mountedRef.current = false
      setMapReady(false)    // reset so click handler re-registers on next mount
      stateLayerRef.current = null   // will be re-fetched on next mount
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Mouse-move: track live lat/lng ────────────────────────────────────────

  useEffect(() => {
    if (!mapRef.current || !mapReady) return

    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      setCursorLatLng({ lat: e.latlng.lat, lng: e.latlng.lng })
    }
    const handleMouseOut = () => setCursorLatLng(null)

    mapRef.current.on('mousemove', handleMouseMove)
    mapRef.current.on('mouseout', handleMouseOut)

    return () => {
      mapRef.current?.off('mousemove', handleMouseMove)
      mapRef.current?.off('mouseout', handleMouseOut)
    }
  }, [mapReady])

  // ── Click handler (respects fetchEnabled) ────────────────────────────────
  // Both fetchWatershed and isFetching are kept in refs so the single
  // registered listener always sees the latest values without re-registering.

  const fetchWatershedRef = useRef(fetchWatershed)
  useEffect(() => { fetchWatershedRef.current = fetchWatershed }, [fetchWatershed])

  const isFetchingRef = useRef(isFetching)
  useEffect(() => { isFetchingRef.current = isFetching }, [isFetching])

  useEffect(() => {
    // Capture the map instance at registration time; clean up against the
    // same instance so the off() always finds the right target.
    const map = mapRef.current
    if (!map || !mapReady) return

    const handleClick = (e: L.LeafletMouseEvent) => {
      if (!fetchEnabledRef.current) return   // toggle is OFF
      if (isFetchingRef.current) return      // already in-flight
      fetchWatershedRef.current(e.latlng.lat, e.latlng.lng)
    }

    map.on('click', handleClick)
    return () => { map.off('click', handleClick) }
  }, [mapReady])

  // ── Layer visibility toggle ───────────────────────────────────────────────

  const toggleLayer = useCallback((name: 'watershed' | 'villages' | 'marker') => {
    if (!mapRef.current) return
    const layerRef =
      name === 'watershed' ? watershedLayerRef :
      name === 'villages' ? villagesLayerRef :
      markerRef

    const layer = layerRef.current
    if (!layer) return

    if (mapRef.current.hasLayer(layer)) {
      mapRef.current.removeLayer(layer)
    } else {
      layer.addTo(mapRef.current)
    }
    syncLayerState()
  }, [syncLayerState])

  // ── Fullscreen (native browser API on the wrapper div) ────────────────────

  const toggleFullscreen = useCallback(() => {
    if (!wrapperRef.current) return

    if (!document.fullscreenElement) {
      wrapperRef.current.requestFullscreen().catch(() => {
        // fallback: just expand via CSS class
        setIsFullscreen(true)
      })
    } else {
      document.exitFullscreen().catch(() => {
        setIsFullscreen(false)
      })
    }
  }, [])

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement)
      // Let Leaflet recalculate after resize
      setTimeout(() => mapRef.current?.invalidateSize(), 100)
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // ── Derived ───────────────────────────────────────────────────────────────

  const hasAnyLayer = layerState.watershed || layerState.villages || layerState.marker

  // Cursor style: crosshair when fetch is enabled and map ready, not-allowed when disabled
  const mapCursorStyle =
    !mapReady ? 'wait' :
    fetchEnabled ? 'crosshair' :
    'not-allowed'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      ref={wrapperRef}
      className={`relative w-full h-full ${className} ${isFullscreen ? 'fixed inset-0 z-[9999] bg-black' : ''}`}
    >
      {/* Map container */}
      <div
        ref={mapContainerRef}
        className="w-full h-full border-4 border-blue-500 rounded-xl"
        style={{ minHeight: 400, cursor: mapCursorStyle }}
      />

      {/* ── Initial map loading ── */}
      {!mapReady && (
        <div className="absolute inset-0 bg-gray-100 bg-opacity-80 flex items-center justify-center z-[999] rounded-xl">
          <div className="text-center">
            <svg className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm text-gray-600">Initialising map…</span>
          </div>
        </div>
      )}

      {/* ── Fetch status overlay (top-right) ── */}
      {(isFetching || fetchingVillages) && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-3 z-[1000] space-y-2 min-w-[200px]">
          {isFetching && (
            <div className="flex items-center space-x-2">
              <svg className="animate-spin h-5 w-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm text-gray-700">Delineating watershed…</span>
            </div>
          )}
          {fetchingVillages && (
            <div className="flex items-center space-x-2">
              <svg className="animate-spin h-5 w-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm text-gray-700">Loading villages…</span>
            </div>
          )}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="absolute top-4 right-4 bg-red-50 border border-red-300 rounded-lg shadow-lg px-4 py-3 z-[1000] max-w-xs">
          <div className="flex items-start space-x-2">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-xs text-red-700 mt-1">{error}</p>
            </div>
          </div>
          <button onClick={() => setError(null)} className="mt-2 text-xs text-red-600 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* ── Top-left toolbar row ── */}
      {mapReady && (
        <div className="absolute top-4 left-14 flex items-center gap-2 z-[1000]">

          {/* Instruction / status hint */}
          <div className="bg-white border border-blue-300 rounded-lg shadow-md px-3 py-2">
            <p className="text-xs font-medium text-blue-800">
              💧{' '}
              {isFetching
                ? 'Fetching watershed boundary…'
                : fetchEnabled
                  ? 'Click map to delineate watershed'
                  : 'Watershed fetch is OFF'}
            </p>
          </div>

          {/* ── Watershed fetch toggle ── */}
          <button
            onClick={() => setFetchEnabled(v => !v)}
            title={fetchEnabled ? 'Disable watershed fetch' : 'Enable watershed fetch'}
            className={`
              flex items-center gap-1.5 px-3 py-2 rounded-lg shadow-md border text-xs font-semibold
              transition-colors duration-200 select-none
              ${fetchEnabled
                ? 'bg-blue-600 border-blue-700 text-white hover:bg-blue-700'
                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}
            `}
          >
            {/* Toggle switch visual */}
            <span
              className={`
                inline-flex w-8 h-4 rounded-full relative transition-colors duration-200
                ${fetchEnabled ? 'bg-blue-300' : 'bg-gray-300'}
              `}
            >
              <span
                className={`
                  absolute top-0.5 w-3 h-3 bg-white rounded-full shadow
                  transition-transform duration-200
                  ${fetchEnabled ? 'translate-x-4' : 'translate-x-0.5'}
                `}
              />
            </span>
            {fetchEnabled ? 'Fetch ON' : 'Fetch OFF'}
          </button>

          {/* ── Fullscreen button ── */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg shadow-md border bg-white border-gray-300 text-gray-600 hover:bg-gray-50 text-xs font-semibold transition-colors duration-200"
          >
            {isFullscreen ? (
              /* Compress icon */
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 9V5m0 4H5m0 0l4-4M15 9h4m-4 0V5m0 4l4-4M9 15v4m0-4H5m0 0l4 4M15 15h4m-4 0v4m0-4l4 4" />
              </svg>
            ) : (
              /* Expand icon */
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
              </svg>
            )}
            {isFullscreen ? 'Exit' : 'Fullscreen'}
          </button>
        </div>
      )}

      {/* ── Layer control dropdown (below toolbar) ── */}
      {hasAnyLayer && mapReady && !isFetching && (
        <div className="absolute top-14 left-14 z-[1000]" style={{ marginTop: 8 }}>
          <div className="bg-white rounded-lg shadow-lg border border-gray-200">
            <button
              onClick={() => setIsLayerDropdownOpen(v => !v)}
              className="flex items-center justify-between w-full px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Layers</span>
              </div>
              <svg className={`w-4 h-4 text-gray-400 ml-2 transition-transform ${isLayerDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isLayerDropdownOpen && (
              <div className="border-t border-gray-100 p-2 space-y-1 min-w-[180px]">
                {(
                  [
                    { key: 'watershed', label: 'Watershed Boundary', dot: '#200453' },
                    { key: 'villages', label: 'Villages', dot: '#140881' },
                    { key: 'marker', label: 'Selected Point', dot: '#ef4444' },
                  ] as const
                )
                  .filter(({ key }) => {
                    const ref = key === 'watershed' ? watershedLayerRef : key === 'villages' ? villagesLayerRef : markerRef
                    return !!ref.current
                  })
                  .map(({ key, label, dot }) => (
                    <button
                      key={key}
                      onClick={() => toggleLayer(key)}
                      className="flex items-center justify-between w-full px-3 py-2 hover:bg-gray-50 rounded transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded flex items-center justify-center ${layerState[key] ? 'bg-blue-600' : 'bg-gray-300'}`}>
                          {layerState[key] && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm text-gray-700">{label}</span>
                      </div>
                      <div className="w-2.5 h-2.5 rounded-full ml-2" style={{ backgroundColor: dot }} />
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Legend (bottom-left) ── */}
      {layerState.villages && mapReady && (
        <div className="absolute bottom-8 left-4 bg-white rounded-lg shadow-md border border-gray-200 px-4 py-3 z-[1000]">
          <h4 className="text-xs font-bold text-gray-700 mb-2">Legend</h4>
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-4 border-2 rounded-sm" style={{ borderColor: '#200453', backgroundColor: 'transparent' }} />
              <span className="text-xs text-gray-600">Watershed</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-5 h-4 border-2 rounded-sm" style={{ borderColor: '#3d7a05', backgroundColor: '#4ad826', opacity: 0.8 }} />
              <span className="text-xs text-gray-600">Selected Village</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-5 h-4 border-2 rounded-sm" style={{ borderColor: '#ce1111', backgroundColor: '#b32e2e', opacity: 10 }} />
              <span className="text-xs text-gray-600">Unselected Village</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3.5 h-3.5 rounded-full border-2 border-white shadow" style={{ backgroundColor: '#ef4444' }} />
              <span className="text-xs text-gray-600">Selected Point</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Live lat/lng display (bottom-right) ── */}
      <div className="absolute bottom-4 right-4 z-[1000]">
        <div
          className={`
            bg-white border border-gray-200 rounded-lg shadow-md px-3 py-1.5
            font-mono text-xs text-gray-700 min-w-[190px] text-center
            transition-opacity duration-150
            ${cursorLatLng ? 'opacity-100' : 'opacity-40'}
          `}
        >
          {cursorLatLng
            ? <>
                <span className="text-gray-400">Lat</span>{' '}
                <span className="font-semibold text-blue-700">{cursorLatLng.lat.toFixed(5)}</span>
                {'  '}
                <span className="text-gray-400">Lng</span>{' '}
                <span className="font-semibold text-blue-700">{cursorLatLng.lng.toFixed(5)}</span>
              </>
            : <span className="text-gray-400">Move cursor over map</span>
          }
        </div>
      </div>
    </div>
  )
}

export default IndCatchmentMap