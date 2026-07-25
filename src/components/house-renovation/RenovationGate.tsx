"use client";

import dynamic from "next/dynamic";

const RenovationApp = dynamic(
  () => import("@/components/house-renovation/RenovationApp").then((m) => m.RenovationApp),
  {
    loading: () => (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">加载中…</div>
    ),
  },
);

export function RenovationGate({ userId }: { userId: string }) {
  return <RenovationApp userId={userId} />;
}
