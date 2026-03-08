"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type RoutePreviewProps = {
  pickupText: string;
  dropoffText: string;
  staffRequired: number;
  onSuggestedWindowMinutes?: (minutes: number | null) => void;
  onEstimateChange?: (estimate: RouteEstimate | null) => void;
};

type Point = { lat: number; lon: number };
export type RouteEstimate = {
  lowEur: number;
  highEur: number;
  billedHours: number;
  provider: "google" | "osm";
  distanceKm: number;
  etaMinutes: number;
  trafficEtaMinutes: number | null;
  trafficLevel: "free" | "moderate" | "busy" | "heavy" | "unknown";
  updatedAt: string;
};

type RouteResult = {
  distanceMeters: number;
  durationSeconds: number;
  coords: Array<[number, number]>;
  trafficDurationSeconds?: number;
  provider: "google" | "osm";
  updatedAt: string;
};

declare global {
  type LeafletBounds = object;
  interface LeafletMap {
    fitBounds: (bounds: LeafletBounds, options?: { padding?: [number, number] }) => void;
  }
  interface LeafletLayerGroup {
    addTo: (map: LeafletMap) => LeafletLayerGroup;
    clearLayers: () => void;
  }
  interface LeafletPolyline {
    addTo: (target: LeafletLayerGroup) => LeafletPolyline;
    getBounds: () => LeafletBounds;
  }
  interface LeafletMarker {
    addTo: (target: LeafletLayerGroup) => LeafletMarker;
  }
  interface LeafletTileLayer {
    addTo: (map: LeafletMap) => LeafletTileLayer;
  }
  interface LeafletApi {
    map: (el: HTMLElement) => LeafletMap;
    tileLayer: (url: string, opts?: Record<string, unknown>) => LeafletTileLayer;
    marker: (latlng: [number, number]) => LeafletMarker;
    polyline: (latlngs: Array<[number, number]>, opts?: Record<string, unknown>) => LeafletPolyline;
    featureGroup: (layers?: unknown[]) => LeafletLayerGroup;
  }

  interface Window {
    L?: LeafletApi;
    google?: GoogleApi;
    __googleMapsLoading?: boolean;
    __googleMapsReady?: boolean;
  }

  type GoogleTravelMode = "DRIVING";
  type GoogleDirectionsStatus = "OK" | string;

  interface GoogleApi {
    maps: {
      Map: new (el: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
      TrafficLayer: new () => GoogleTrafficLayer;
      Geocoder: new () => GoogleGeocoder;
      DirectionsService: new () => GoogleDirectionsService;
      DirectionsRenderer: new (options?: Record<string, unknown>) => GoogleDirectionsRenderer;
      TravelMode: { DRIVING: GoogleTravelMode };
    };
  }

  type GoogleMapInstance = object;
  interface GoogleTrafficLayer {
    setMap: (map: GoogleMapInstance | null) => void;
  }
  interface GoogleDirectionsRenderer {
    setMap: (map: GoogleMapInstance | null) => void;
    setDirections: (result: GoogleDirectionsResult) => void;
  }
  interface GoogleGeocoder {
    geocode: (
      request: { address: string },
      callback: (results: unknown[], status: string) => void
    ) => void;
  }
  interface GoogleDirectionsService {
    route: (
      request: {
        origin: string;
        destination: string;
        travelMode: GoogleTravelMode;
        drivingOptions?: { departureTime: Date; trafficModel: "bestguess" };
      },
      callback: (result: GoogleDirectionsResult | null, status: GoogleDirectionsStatus) => void
    ) => void;
  }
  interface GoogleDirectionsLeg {
    distance?: { value?: number };
    duration?: { value?: number };
    duration_in_traffic?: { value?: number };
  }
  interface GoogleDirectionsRoute {
    legs?: GoogleDirectionsLeg[];
  }
  interface GoogleDirectionsResult {
    routes?: GoogleDirectionsRoute[];
  }
}

async function geocodeAddress(query: string): Promise<Point | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "1");
  const response = await fetch(url.toString());
  if (!response.ok) return null;
  const data = (await response.json()) as Array<{ lat: string; lon: string }>;
  if (!data[0]) return null;
  return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
}

async function findRoute(pickup: Point, dropoff: Point): Promise<RouteResult | null> {
  const url = new URL(
    `https://router.project-osrm.org/route/v1/driving/${pickup.lon},${pickup.lat};${dropoff.lon},${dropoff.lat}`
  );
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  const response = await fetch(url.toString());
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    routes?: Array<{ distance: number; duration: number; geometry: { coordinates: Array<[number, number]> } }>;
  };
  const route = payload.routes?.[0];
  if (!route) return null;
  return {
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    coords: route.geometry.coordinates,
    provider: "osm",
    updatedAt: new Date().toISOString()
  };
}

function useLeafletReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.L) {
      setReady(true);
      return;
    }

    if (!document.getElementById("leaflet-css")) {
      const css = document.createElement("link");
      css.id = "leaflet-css";
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(css);
    }

    const existing = document.getElementById("leaflet-js") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => setReady(true), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = "leaflet-js";
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => setReady(true);
    document.body.appendChild(script);
  }, []);

  return ready;
}

function useGoogleMapsReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) return;

    if (window.google?.maps) {
      window.__googleMapsReady = true;
      setReady(true);
      return;
    }

    if (window.__googleMapsLoading) return;
    window.__googleMapsLoading = true;

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`;
    script.async = true;
    script.onload = () => {
      window.__googleMapsReady = true;
      setReady(true);
    };
    script.onerror = () => {
      window.__googleMapsLoading = false;
    };
    document.body.appendChild(script);
  }, []);

  return ready;
}

function classifyTraffic(durationSeconds: number | null, trafficSeconds: number | null) {
  if (!durationSeconds || !trafficSeconds) return "unknown";
  const ratio = trafficSeconds / durationSeconds;
  if (ratio <= 1.05) return "free";
  if (ratio <= 1.2) return "moderate";
  if (ratio <= 1.45) return "busy";
  return "heavy";
}

function roundToHalfHour(hours: number) {
  return Math.max(1, Math.ceil(hours * 2) / 2);
}

function estimateHourlyQuote(durationMinutes: number, staffRequired: number) {
  const baseRatePerHour = 25;
  const extraStaffRatePerHour = 15;
  const extraStaffCount = Math.max(0, staffRequired - 1);
  const baseHourly = baseRatePerHour + extraStaffCount * extraStaffRatePerHour;
  const rateLow = baseHourly * 0.9;
  const rateHigh = baseHourly * 1.2;
  const handlingBufferMinutes = Math.max(30, staffRequired * 15);
  const billedHours = roundToHalfHour((durationMinutes + handlingBufferMinutes) / 60);
  const low = Math.round(billedHours * rateLow);
  const high = Math.max(low + 1, Math.round(billedHours * rateHigh));
  return { low, high, billedHours, baseRatePerHour, extraStaffRatePerHour, extraStaffCount };
}

export function RoutePreview({
  pickupText,
  dropoffText,
  staffRequired,
  onSuggestedWindowMinutes,
  onEstimateChange
}: RoutePreviewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const routeLayerRef = useRef<LeafletLayerGroup | null>(null);
  const googleMapRef = useRef<GoogleMapInstance | null>(null);
  const googleRendererRef = useRef<GoogleDirectionsRenderer | null>(null);
  const googleTrafficLayerRef = useRef<GoogleTrafficLayer | null>(null);
  const leafletReady = useLeafletReady();
  const googleReady = useGoogleMapsReady();
  const googleKeyExists = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);

  useEffect(() => {
    if (pickupText.trim().length < 5 || dropoffText.trim().length < 5) {
      setRoute(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        if (googleKeyExists && googleReady && window.google?.maps) {
          const google = window.google.maps;
          const directionsService = new google.DirectionsService();
          const directionsResult = await new Promise<GoogleDirectionsResult | null>((resolve) => {
            directionsService.route(
              {
                origin: pickupText,
                destination: dropoffText,
                travelMode: google.TravelMode.DRIVING,
                drivingOptions: {
                  departureTime: new Date(),
                  trafficModel: "bestguess"
                }
              },
              (result, status) => resolve(status === "OK" ? result : null)
            );
          });

          const leg = directionsResult?.routes?.[0]?.legs?.[0];
          if (!leg?.distance?.value || !leg?.duration?.value) {
            if (!cancelled) {
              setRoute(null);
              setError("Could not calculate route right now.");
            }
            return;
          }
          if (!cancelled) {
            setRoute({
              distanceMeters: leg.distance.value,
              durationSeconds: leg.duration.value,
              trafficDurationSeconds: leg.duration_in_traffic?.value,
              coords: [],
              provider: "google",
              updatedAt: new Date().toISOString()
            });
          }
        } else {
          const [pickup, dropoff] = await Promise.all([geocodeAddress(pickupText), geocodeAddress(dropoffText)]);
          if (!pickup || !dropoff) {
            if (!cancelled) {
              setRoute(null);
              setError("Could not locate one or both addresses on the map.");
            }
            return;
          }
          const routed = await findRoute(pickup, dropoff);
          if (!routed) {
            if (!cancelled) {
              setRoute(null);
              setError("Could not calculate route right now.");
            }
            return;
          }
          if (!cancelled) {
            setRoute({
              ...routed,
              provider: "osm",
              updatedAt: new Date().toISOString()
            });
          }
        }
      } catch {
        if (!cancelled) {
          setRoute(null);
          setError("Route service is temporarily unavailable.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 700);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [dropoffText, googleKeyExists, googleReady, pickupText]);

  useEffect(() => {
    if (!mapContainerRef.current || !route) return;
    if (route.provider === "google") return;
    if (!leafletReady) return;

    const L = window.L;
    if (!L) return;

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(mapRef.current);
    }

    if (routeLayerRef.current) {
      routeLayerRef.current.clearLayers();
    } else {
      routeLayerRef.current = L.featureGroup().addTo(mapRef.current);
    }

    const latLngs = route.coords.map(([lon, lat]) => [lat, lon] as [number, number]);
    if (latLngs.length < 2) return;
    const polyline = L.polyline(latLngs, { color: "#0f172a", weight: 4 }).addTo(routeLayerRef.current);
    L.marker(latLngs[0]).addTo(routeLayerRef.current);
    L.marker(latLngs[latLngs.length - 1]).addTo(routeLayerRef.current);
    mapRef.current.fitBounds(polyline.getBounds(), { padding: [24, 24] });
  }, [leafletReady, route]);

  useEffect(() => {
    if (!mapContainerRef.current || !route || route.provider !== "google") return;
    if (!googleReady || !window.google?.maps) return;

    const google = window.google.maps;
    if (!googleMapRef.current) {
      googleMapRef.current = new google.Map(mapContainerRef.current, {
        center: { lat: 60.1699, lng: 24.9384 },
        zoom: 11,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      });
      googleRendererRef.current = new google.DirectionsRenderer({
        suppressMarkers: false
      });
      googleRendererRef.current.setMap(googleMapRef.current);
      googleTrafficLayerRef.current = new google.TrafficLayer();
      googleTrafficLayerRef.current.setMap(googleMapRef.current);
    }

    const directionsService = new google.DirectionsService();
    directionsService.route(
      {
        origin: pickupText,
        destination: dropoffText,
        travelMode: google.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: "bestguess"
        }
      },
      (result, status) => {
        if (status === "OK" && result && googleRendererRef.current) {
          googleRendererRef.current.setDirections(result);
        }
      }
    );
  }, [dropoffText, googleReady, pickupText, route]);

  const etaMinutes = useMemo(() => (route ? Math.max(1, Math.round(route.durationSeconds / 60)) : null), [route]);
  const distanceKm = useMemo(() => (route ? (route.distanceMeters / 1000).toFixed(1) : null), [route]);
  const trafficEtaMinutes = useMemo(
    () => (route?.trafficDurationSeconds ? Math.max(1, Math.round(route.trafficDurationSeconds / 60)) : null),
    [route]
  );
  const trafficLevel = useMemo(
    () => classifyTraffic(route?.durationSeconds ?? null, route?.trafficDurationSeconds ?? null),
    [route]
  );
  const suggestedWindowMinutes = useMemo(() => (etaMinutes ? etaMinutes + 30 : null), [etaMinutes]);
  const quoteRange = useMemo(() => {
    if (!route || !etaMinutes || !distanceKm) return null;
    const distance = Number(distanceKm);
    if (Number.isNaN(distance)) return null;
    const driveMinutes = trafficEtaMinutes ?? etaMinutes;
    return estimateHourlyQuote(driveMinutes, staffRequired);
  }, [distanceKm, etaMinutes, route, staffRequired, trafficEtaMinutes]);

  useEffect(() => {
    onSuggestedWindowMinutes?.(suggestedWindowMinutes);
  }, [onSuggestedWindowMinutes, suggestedWindowMinutes]);

  useEffect(() => {
    if (!route || !quoteRange || !distanceKm || !etaMinutes) {
      onEstimateChange?.(null);
      return;
    }
    const distance = Number(distanceKm);
    if (Number.isNaN(distance)) {
      onEstimateChange?.(null);
      return;
    }
    onEstimateChange?.({
      lowEur: quoteRange.low,
      highEur: quoteRange.high,
      billedHours: quoteRange.billedHours,
      provider: route.provider,
      distanceKm: distance,
      etaMinutes,
      trafficEtaMinutes,
      trafficLevel,
      updatedAt: route.updatedAt
    });
  }, [distanceKm, etaMinutes, onEstimateChange, quoteRange, route, trafficEtaMinutes, trafficLevel]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
      <h3 className="text-lg font-semibold text-slate-900">Route Preview</h3>
      <p className="mt-1 text-sm text-slate-600">Live estimate based on entered pickup and dropoff addresses.</p>
      <div className="mt-3 h-72 rounded-2xl border border-slate-200 bg-blue-100 md:h-80" ref={mapContainerRef} />
      {loading ? <p className="mt-2 text-sm text-slate-500">Calculating route...</p> : null}
      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
      {!loading && !error && route ? (
        <div className="mt-3 grid gap-2 text-sm text-slate-700">
          <p>
            <strong>Provider:</strong> {route.provider === "google" ? "Google Maps" : "OpenStreetMap/OSRM"}
          </p>
          <p>
            <strong>Distance:</strong> {distanceKm} km
          </p>
          <p>
            <strong>ETA:</strong> {etaMinutes} minutes
          </p>
          <p>
            <strong>Traffic ETA:</strong> {trafficEtaMinutes ? `${trafficEtaMinutes} minutes` : "Not available"}
          </p>
          <p>
            <strong>Traffic status:</strong>{" "}
            {trafficLevel === "unknown" ? "Not available for current provider" : trafficLevel}
          </p>
          <p>
            <strong>Suggested window:</strong> at least {suggestedWindowMinutes} minutes (ETA + 30 min buffer)
          </p>
          <p>
            <strong>Estimated price:</strong>{" "}
            {quoteRange ? `EUR ${quoteRange.low} - EUR ${quoteRange.high} (rough)` : "Not available"}
          </p>
          {quoteRange ? (
            <p className="text-xs text-slate-500">
              Estimate only. Approx. {quoteRange.billedHours} billable hour(s). Pricing model: EUR{" "}
              {quoteRange.baseRatePerHour}/h base + EUR {quoteRange.extraStaffRatePerHour}/h per extra staff (
              {quoteRange.extraStaffCount} extra). Final quote is admin-confirmed.
            </p>
          ) : null}
          <p className="text-xs text-slate-500">Updated: {new Date(route.updatedAt).toLocaleTimeString()}</p>
        </div>
      ) : null}
      {!loading && !route && !error ? (
        <p className="mt-2 text-sm text-slate-500">Enter both addresses to preview route and ETA.</p>
      ) : null}
    </div>
  );
}
