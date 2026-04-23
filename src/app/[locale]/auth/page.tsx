import { getTranslations } from "next-intl/server";

import { AuthForm } from "@/components/auth/AuthForm";

export default async function AuthPage() {
  const t = await getTranslations("auth");

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md space-y-4">
        <p className="text-center text-sm text-muted-foreground">
          {t("title")}
        </p>
        <AuthForm />
      </div>
    </div>
  );
}

