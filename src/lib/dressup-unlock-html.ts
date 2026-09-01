import { dressupOriginAlternates } from "@/lib/dressup-origins";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function page(locale: "zh" | "en", title: string, inner: string, extraHead = "") {
  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
${extraHead}
<style>
  body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font:14px/1.5 system-ui,sans-serif;background:#FAF9F7;color:#52525b;padding:24px;text-align:center}
  a{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;background:#18181b;color:#fafafa;text-decoration:none;font-weight:600;padding:8px 16px}
</style>
</head>
<body>${inner}</body>
</html>`;
}

export function dressupUnlockHtmlResponse(html: string, status = 200) {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function dressupUnlockNeedPlusHtml(locale: "zh" | "en", pricingHref: string) {
  const title = locale === "en" ? "Plus required" : "需要 Plus";
  const body =
    locale === "en"
      ? "This account is not Plus yet. Subscribe to unlock full Manor."
      : "当前账号还不是 Plus 会员，开通后即可解锁完整宅宴。";
  const cta = locale === "en" ? "Get Plus" : "去开通 Plus";
  return page(
    locale,
    title,
    `<p>${escapeHtml(body)}</p><p><a href="${escapeHtml(pricingHref)}">${escapeHtml(cta)}</a></p>`,
  );
}

export function dressupUnlockErrorHtml(locale: "zh" | "en") {
  const title = locale === "en" ? "Could not confirm" : "确认失败";
  const body =
    locale === "en"
      ? "Could not confirm membership. Try again later."
      : "确认会员失败，请稍后重试。";
  return page(locale, title, `<p>${escapeHtml(body)}</p>`);
}

export function dressupUnlockStayHtml(locale: "zh" | "en") {
  const title = locale === "en" ? "Plus confirmed" : "已是 Plus";
  const body =
    locale === "en"
      ? "You are Plus. Close this tab and return to Manor; unlock again if needed."
      : "已是 Plus。请关闭本页，回到宅宴；若未解锁请再点一次确认解锁。";
  return page(locale, title, `<p>${escapeHtml(body)}</p>`);
}

export function dressupUnlockBounceHtml(params: {
  locale: "zh" | "en";
  dressupOrigin: string;
  returnUrl: string;
}) {
  const dest = new URL(params.returnUrl);
  dest.searchParams.set("kapi_plus", "1");
  dest.searchParams.set("at", String(Date.now()));
  const href = dest.toString();
  const title = params.locale === "en" ? "Returning to Manor" : "正在返回宅宴";
  const body =
    params.locale === "en" ? "Plus confirmed — returning to Manor…" : "已确认 Plus，正在返回宅宴并解锁…";
  const payload = {
    source: "kapi-finance",
    type: "dressup-plus",
    plus: true,
    at: Date.now(),
  };
  const script = `<script>
(function(){
  var payload = ${JSON.stringify(payload)};
  var targets = ${JSON.stringify(dressupOriginAlternates(params.dressupOrigin))};
  var href = ${JSON.stringify(href)};
  if (window.opener && !window.opener.closed) {
    for (var i = 0; i < targets.length; i++) {
      try { window.opener.postMessage(payload, targets[i]); } catch (e) {}
    }
    window.close();
    return;
  }
  location.replace(href);
})();
</script>`;
  const back = params.locale === "en" ? "Back to Manor" : "返回宅宴";
  return page(
    params.locale,
    title,
    `<p>${escapeHtml(body)}</p><p><a href="${escapeHtml(href)}">${escapeHtml(back)}</a></p>${script}`,
  );
}

export function dressupPlusPingHtml(params: {
  targetOrigin: string;
  status: "plus" | "not-plus" | "unknown";
  plus?: boolean;
  reason?: string;
}) {
  const payload = {
    source: "kapi-finance",
    type: "dressup-plus-status",
    status: params.status,
    plus: params.plus === true,
    ...(params.reason ? { reason: params.reason } : {}),
  };
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title></title></head>
<body><script>
(function(){
  var payload = ${JSON.stringify(payload)};
  var targets = ${JSON.stringify(dressupOriginAlternates(params.targetOrigin))};
  for (var i = 0; i < targets.length; i++) {
    try { parent.postMessage(payload, targets[i]); } catch (e) {}
  }
})();
</script></body></html>`;
}
