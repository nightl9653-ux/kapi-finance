"use client";

import dynamic from "next/dynamic";

const BanquetPartyApp = dynamic(
  () => import("@/components/banquet-party/BanquetPartyApp").then((m) => m.BanquetPartyApp),
  {
    loading: () => (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">加载中…</div>
    ),
  },
);

export function BanquetPartyGate({ userId }: { userId: string }) {
  return <BanquetPartyApp userId={userId} />;
}
