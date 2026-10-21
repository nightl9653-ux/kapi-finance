"use client";

import dynamic from "next/dynamic";

const TravelApp = dynamic(() => import("@/components/travel/TravelApp").then((m) => m.TravelApp), {
  loading: () => (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">加载中…</div>
  ),
});

export function TravelGate({ userId }: { userId: string }) {
  return <TravelApp userId={userId} />;
}
