"use client";

import { useEffect, useRef, useState } from "react";
import type { UserProfile, VenueProposal } from "@/types";
import { getProxyColor } from "@/lib/utils";


interface TravelData {
  userId: string;
  userName: string;
  travelMinutes: number;
  latitude: number;
  longitude: number;
}

interface FairnessMapProps {
  users: UserProfile[];
  venue: VenueProposal | null;
  travelData?: TravelData[];
}

function getTravelColor(minutes: number, avgMinutes: number): string {
  const ratio = minutes / (avgMinutes || 1);
  if (ratio <= 1.15) return "#34d399"; // green - fair
  if (ratio <= 1.5) return "#fbbf24"; // amber - slight imbalance
  return "#f87171"; // red - unfair
}

// Fallback static map display when Mapbox isn't available
function StaticMapFallback({
  users,
  venue,
  travelData,
}: FairnessMapProps) {
  const avgMinutes =
    travelData && travelData.length > 0
      ? travelData.reduce((s, t) => s + t.travelMinutes, 0) / travelData.length
      : 0;

  return (
    <div className="w-full h-full flex flex-col bg-[#0d0d14] rounded-xl overflow-hidden border border-white/8">
      {/* Map header */}
      <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Travel Fairness Map</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {venue ? venue.name : "No venue selected yet"}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="text-slate-500">Fair</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-slate-500">Slight</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span className="text-slate-500">Unfair</span>
          </div>
        </div>
      </div>

      {/* Simulated map area */}
      <div className="flex-1 relative bg-[#0d0d14] flex items-center justify-center overflow-hidden">
        {/* Grid lines to simulate map */}
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Venue marker */}
        {venue && (
          <div className="relative z-10">
            <div className="flex flex-col items-center">
              <div
                className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-base animate-pulse"
                style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
              >
                📍
              </div>
              <div className="mt-2 px-3 py-1.5 rounded-lg bg-[#1a1a2e] border border-white/20 text-xs text-white font-medium max-w-xs text-center">
                {venue.name}
              </div>
            </div>
          </div>
        )}

        {!venue && (
          <div className="text-center text-slate-600">
            <div className="text-4xl mb-2">🗺️</div>
            <div className="text-sm">Map will show when a venue is proposed</div>
          </div>
        )}
      </div>

      {/* Travel times table */}
      {travelData && travelData.length > 0 && (
        <div className="border-t border-white/8">
          <div className="px-5 py-3">
            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
              Travel Times
            </h4>
            <div className="space-y-2">
              {travelData.map((t, i) => {
                const color = getTravelColor(t.travelMinutes, avgMinutes);
                return (
                  <div key={t.userId} className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{
                        backgroundColor: `${getProxyColor(i)}20`,
                        border: `1.5px solid ${getProxyColor(i)}50`,
                        color: getProxyColor(i),
                      }}
                    >
                      {t.userName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-300 truncate">{t.userName}</span>
                        <span className="text-xs font-mono font-medium ml-2" style={{ color }}>
                          {t.travelMinutes} min
                        </span>
                      </div>
                      <div className="mt-1 h-1 bg-[#2d2d3f] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, (t.travelMinutes / 60) * 100)}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Main FairnessMap — tries to load Mapbox, falls back gracefully
export function FairnessMap({ users, venue, travelData }: FairnessMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const [mapboxLoaded, setMapboxLoaded] = useState(false);
  const [mapboxError, setMapboxError] = useState(false);

  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainerRef.current) {
      setMapboxError(true);
      return;
    }

    // Resolve coordinates — backend may send lat/lng or latitude/longitude
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = venue as any;
    const venueLat: number | null = v?.latitude ?? v?.lat ?? null;
    const venueLng: number | null = v?.longitude ?? v?.lng ?? null;

    let isMounted = true;

    import("mapbox-gl")
      .then((mapboxgl) => {
        if (!isMounted || !mapContainerRef.current) return;

        mapboxgl.default.accessToken = MAPBOX_TOKEN;
        const map = new mapboxgl.default.Map({
          container: mapContainerRef.current,
          style: "mapbox://styles/mapbox/dark-v11",
          center: [venueLng ?? -73.9857, venueLat ?? 40.7484],
          zoom: 13,
        });

        mapRef.current = map;

        map.on("load", () => {
          if (!isMounted) return;
          setMapboxLoaded(true);

          // Venue marker
          if (venue && venueLat != null && venueLng != null) {
            const el = document.createElement("div");
            el.style.cssText = `
              width: 36px; height: 36px;
              background: rgba(255,255,255,0.9);
              border-radius: 50%;
              border: 3px solid #fff;
              display: flex; align-items: center; justify-content: center;
              font-size: 18px;
              box-shadow: 0 0 20px rgba(255,255,255,0.4);
              cursor: pointer;
            `;
            el.textContent = "📍";

            new mapboxgl.default.Marker({ element: el })
              .setLngLat([venueLng, venueLat])
              .setPopup(
                new mapboxgl.default.Popup({ offset: 25 }).setHTML(`
                  <div style="background:#1a1a2e;color:#e2e8f0;padding:8px 12px;border-radius:8px;font-size:12px">
                    <strong>${venue.name}</strong><br/>
                    ${venue.address}
                  </div>
                `)
              )
              .addTo(map);
          }

          // User markers
          const avgMinutes =
            travelData && travelData.length > 0
              ? travelData.reduce((s, x) => s + x.travelMinutes, 0) / travelData.length
              : 20;

          travelData?.forEach((t, i) => {
            if (!t.latitude || !t.longitude) return;
            const color = getProxyColor(i);
            const travelColor = getTravelColor(t.travelMinutes, avgMinutes);

            const el = document.createElement("div");
            el.style.cssText = `
              width: 20px; height: 20px;
              background: ${color};
              border-radius: 50%;
              border: 2px solid rgba(255,255,255,0.6);
              box-shadow: 0 0 8px ${color}80;
            `;

            new mapboxgl.default.Marker({ element: el })
              .setLngLat([t.longitude, t.latitude])
              .setPopup(
                new mapboxgl.default.Popup({ offset: 15 }).setHTML(`
                  <div style="background:#1a1a2e;color:#e2e8f0;padding:8px 12px;border-radius:8px;font-size:12px">
                    <strong>${t.userName}</strong><br/>
                    <span style="color:${travelColor}">${t.travelMinutes} min travel</span>
                  </div>
                `)
              )
              .addTo(map);

            if (venueLat != null && venueLng != null) {
              const sourceId = `travel-line-${i}`;
              map.addSource(sourceId, {
                type: "geojson",
                data: {
                  type: "Feature",
                  properties: {},
                  geometry: {
                    type: "LineString",
                    coordinates: [
                      [t.longitude, t.latitude],
                      [venueLng, venueLat],
                    ],
                  },
                },
              });
              map.addLayer({
                id: `layer-${sourceId}`,
                type: "line",
                source: sourceId,
                paint: {
                  "line-color": travelColor,
                  "line-width": 2,
                  "line-opacity": 0.5,
                  "line-dasharray": [3, 3],
                },
              });
            }
          });
        });
      })
      .catch(() => {
        if (isMounted) setMapboxError(true);
      });

    return () => {
      isMounted = false;
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
      }
    };
  }, [MAPBOX_TOKEN, venue, travelData]);

  if (mapboxError || !MAPBOX_TOKEN) {
    return <StaticMapFallback users={users} venue={venue} travelData={travelData} />;
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="absolute inset-0 rounded-xl overflow-hidden" />
      {!mapboxLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d14] rounded-xl">
          <div className="text-slate-500 text-sm">Loading map...</div>
        </div>
      )}
    </div>
  );
}
