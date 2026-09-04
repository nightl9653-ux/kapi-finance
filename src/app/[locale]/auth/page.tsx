import { Suspense } from "react";

import { AuthForm } from "@/components/auth/AuthForm";

export default function AuthPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Suspense>
        <AuthForm />
      </Suspense>
    </div>
  );
}
