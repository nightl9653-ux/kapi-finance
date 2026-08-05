import { Suspense } from "react";

import { UnlockDressupClient } from "@/components/dressup/UnlockDressupClient";

export default function UnlockDressupPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[50vh] max-w-lg items-center justify-center px-6 text-center">
          <p className="text-sm text-muted-foreground">正在确认咔账会员…</p>
        </main>
      }
    >
      <UnlockDressupClient />
    </Suspense>
  );
}
