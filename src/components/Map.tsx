import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type { MapViewProps } from "./MapView";

const MapView = lazy(() => import("./MapView"));

function MapSkeleton({ className }: { className?: string }) {
  return (
    <div className={`${className ?? "h-full w-full"} animate-pulse bg-muted`} />
  );
}

export function Map(props: MapViewProps) {
  return (
    <ClientOnly fallback={<MapSkeleton className={props.className} />}>
      <Suspense fallback={<MapSkeleton className={props.className} />}>
        <MapView {...props} />
      </Suspense>
    </ClientOnly>
  );
}
