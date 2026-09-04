import { Suspense } from "react";

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage() {
  let hasSession = false;
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    hasSession = Boolean(data.user);
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Suspense>
        <ResetPasswordForm hasSession={hasSession} />
      </Suspense>
    </div>
  );
}
