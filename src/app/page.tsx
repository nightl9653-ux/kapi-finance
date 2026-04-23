import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  const h = await headers();
  const acceptLanguage = h.get("accept-language") ?? "";
  const locale = acceptLanguage.toLowerCase().includes("zh") ? "zh" : "en";
  redirect(`/${locale}`);
}
