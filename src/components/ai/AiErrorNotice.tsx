"use client";

import { cn } from "@/lib/utils";

export function AiErrorNotice({
  message,
  className,
}: {
  message: string | null | undefined;
  className?: string;
}) {
  if (!message) return null;
  return <div className={cn("text-sm text-destructive", className)}>{message}</div>;
}

