"use client";

import dynamic from "next/dynamic";

const GigsApp = dynamic(() => import("@/components/gigs/GigsApp").then((m) => m.GigsApp), {
  loading: () => (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">…</div>
  ),
});

export function GigsGate({ userId }: { userId: string }) {
  return <GigsApp userId={userId} />;
}
