import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/geo";

export type MapViewProps = {
  center: LatLng;
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  driver?: LatLng | null;
  nearby?: LatLng[];
  route?: [number, number][];
  draggablePickup?: boolean;
  onPickupMove?: (p: LatLng) => void;
  className?: string;
};

function pinIcon(color: string, glyph: string) {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:${color};color:#0b0c0e;font:700 13px/1 system-ui;box-shadow:0 4px 14px rgba(0,0,0,.35);border:2px solid rgba(255,255,255,.85)">${glyph}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

export default function MapView({
  center,
  pickup,
  dropoff,
  driver,
  nearby,
  route,
  draggablePickup,
  onPickupMove,
  className,
}: MapViewProps) {
  const el = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<Record<string, L.Layer | null>>({});
  const nearbyLayer = useRef<L.LayerGroup | null>(null);

  const icons = useMemo(
    () => ({
      pickup: pinIcon("#7CFF5A", "A"),
      dropoff: pinIcon("#FFFFFF", "B"),
      driver: pinIcon("#7CFF5A", "▲"),
      other: pinIcon("#9aa0a6", "•"),
    }),
    [],
  );

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView(
      [center.lat, center.lng],
      13,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(m);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    nearbyLayer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // markers
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const upsert = (key: string, pos: LatLng | null | undefined, icon: L.DivIcon, drag = false) => {
      const existing = layers.current[key] as L.Marker | null;
      if (!pos) {
        if (existing) m.removeLayer(existing);
        layers.current[key] = null;
        return;
      }
      if (existing) {
        existing.setLatLng([pos.lat, pos.lng]);
      } else {
        const marker = L.marker([pos.lat, pos.lng], { icon, draggable: drag }).addTo(m);
        if (drag) {
          marker.on("dragend", () => {
            const ll = marker.getLatLng();
            onPickupMove?.({ lat: ll.lat, lng: ll.lng });
          });
        }
        layers.current[key] = marker;
      }
    };
    upsert("pickup", pickup, icons.pickup, !!draggablePickup);
    upsert("dropoff", dropoff, icons.dropoff);
    upsert("driver", driver, icons.driver);
  }, [pickup, dropoff, driver, icons, draggablePickup, onPickupMove]);

  // nearby drivers
  useEffect(() => {
    const group = nearbyLayer.current;
    if (!group) return;
    group.clearLayers();
    (nearby ?? []).forEach((p) => {
      L.marker([p.lat, p.lng], { icon: icons.other }).addTo(group);
    });
  }, [nearby, icons]);

  // route line + fit
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const existing = layers.current["route"] as L.Polyline | null;
    if (existing) m.removeLayer(existing);
    if (route && route.length > 1) {
      const line = L.polyline(route, { color: "#7CFF5A", weight: 5, opacity: 0.9 }).addTo(m);
      layers.current["route"] = line;
      m.fitBounds(line.getBounds().pad(0.25), { animate: true });
    } else {
      layers.current["route"] = null;
    }
  }, [route]);

  // recenter when no route
  useEffect(() => {
    const m = map.current;
    if (!m || (route && route.length > 1)) return;
    m.setView([center.lat, center.lng], m.getZoom() < 13 ? 14 : m.getZoom(), { animate: true });
  }, [center.lat, center.lng, route]);

  return <div ref={el} className={className ?? "h-full w-full"} />;
}
