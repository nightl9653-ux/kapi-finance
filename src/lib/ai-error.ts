export type AiErrorKind = "scan" | "voice";

export type TranslateFn = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

export function mapAiErrorCode({
  kind,
  code,
  t,
  limit,
  dailyLimit,
}: {
  kind: AiErrorKind;
  code: string | undefined;
  t: TranslateFn;
  /** 服务端返回的本次请求限额（可选） */
  limit?: number;
  /** 页面注入的日限额（用于兜底展示） */
  dailyLimit?: number;
}): string {
  const n = limit ?? dailyLimit;
  const nSafe = typeof n === "number" ? n : 0;

  if (kind === "voice") {
    switch (code) {
      case "file_too_large":
        return t("voiceErrorTooLarge");
      case "unsupported_type":
        return t("voiceErrorUnsupportedType");
      case "bad_file":
        return t("voiceErrorBadFile");
      case "unrecognized":
        return t("voiceErrorUnrecognized");
      case "rate_limit":
        return t("voiceErrorRateLimitDetail", { n: nSafe });
      default:
        // fallthrough to scan mapping for shared cases
        break;
    }
  }

  switch (code) {
    case "unauthenticated":
      return t("scanErrorUnauthenticated");
    case "rate_limit":
      return t("scanErrorRateLimitDetail", { n: nSafe });
    case "file_too_large":
      return t("scanErrorTooLarge");
    case "unsupported_type":
      return t("scanErrorUnsupportedType");
    case "bad_file":
      return t("scanErrorBadFile");
    case "unrecognized":
      return t("scanErrorUnrecognized");
    case "openai_unconfigured":
    case "openai_failed":
    case "ocr_failed":
      return t("scanErrorService");
    default:
      return t("scanErrorGeneric");
  }
}

