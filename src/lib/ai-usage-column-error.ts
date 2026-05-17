/** PostgREST / Postgres：ai_usage 表尚未执行迁移、缺少计数字段时 */
export function isAiUsageColumnMissingError(
  error: { code?: string; message?: string; details?: string } | null,
): boolean {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  if (text.includes("does not exist") && text.includes("ai_usage")) return true;
  if (text.includes("could not find") && text.includes("_count")) return true;
  return false;
}
