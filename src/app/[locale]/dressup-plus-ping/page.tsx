import { Suspense } from "react";

import { DressupPlusPingClient } from "@/components/dressup/DressupPlusPingClient";

/** 宅宴静默核对 Plus（隐藏 iframe 加载） */
export default function DressupPlusPingPage() {
  return (
    <Suspense fallback={null}>
      <DressupPlusPingClient />
    </Suspense>
  );
}
