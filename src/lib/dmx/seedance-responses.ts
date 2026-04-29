type DmxJson = Record<string, unknown>;

function asRecord(v: unknown): DmxJson | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as DmxJson) : null;
}

function fixTosUrl(url: string): string {
  // 文档里常出现 \u0026 转义
  return url.replace(/\\u0026/g, "&");
}

export async function dmxPostResponses(params: { baseURL: string; apiKey: string; payload: unknown }): Promise<unknown> {
  const url = `${params.baseURL.replace(/\/$/, "")}/responses`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    // DMXAPI 示例里两种方式都见到过：Bearer sk-... 或直接 sk-...
    Authorization: params.apiKey.startsWith("Bearer ") ? params.apiKey : params.apiKey,
  };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(params.payload),
    cache: "no-store",
  });

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const msg =
      parsed && typeof parsed === "object" && "error" in (parsed as Record<string, unknown>)
        ? JSON.stringify((parsed as Record<string, unknown>).error)
        : text.slice(0, 800);
    throw new Error(`dmx_http_${res.status}:${msg}`);
  }

  return parsed;
}

export async function dmxGetResponseById(params: { baseURL: string; apiKey: string; id: string }): Promise<unknown> {
  const id = String(params.id ?? "").trim();
  if (!id) throw new Error("dmx_missing_task_id");
  const url = `${params.baseURL.replace(/\/$/, "")}/responses/${encodeURIComponent(id)}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: params.apiKey.startsWith("Bearer ") ? params.apiKey : params.apiKey,
  };
  const res = await fetch(url, { method: "GET", headers, cache: "no-store" });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    const msg =
      parsed && typeof parsed === "object" && "error" in (parsed as Record<string, unknown>)
        ? JSON.stringify((parsed as Record<string, unknown>).error)
        : text.slice(0, 800);
    throw new Error(`dmx_http_${res.status}:${msg}`);
  }
  return parsed;
}

export async function dmxPostVideos(params: { baseURL: string; apiKey: string; payload: unknown }): Promise<unknown> {
  const url = `${params.baseURL.replace(/\/$/, "")}/videos`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: params.apiKey.startsWith("Bearer ") ? params.apiKey : params.apiKey,
  };
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(params.payload), cache: "no-store" });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    const msg =
      parsed && typeof parsed === "object" && "error" in (parsed as Record<string, unknown>)
        ? JSON.stringify((parsed as Record<string, unknown>).error)
        : text.slice(0, 800);
    throw new Error(`dmx_http_${res.status}:${msg}`);
  }
  return parsed;
}

export async function dmxGetVideoById(params: { baseURL: string; apiKey: string; id: string }): Promise<unknown> {
  const id = String(params.id ?? "").trim();
  if (!id) throw new Error("dmx_missing_task_id");
  const url = `${params.baseURL.replace(/\/$/, "")}/videos/${encodeURIComponent(id)}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: params.apiKey.startsWith("Bearer ") ? params.apiKey : params.apiKey,
  };
  const res = await fetch(url, { method: "GET", headers, cache: "no-store" });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    const msg =
      parsed && typeof parsed === "object" && "error" in (parsed as Record<string, unknown>)
        ? JSON.stringify((parsed as Record<string, unknown>).error)
        : text.slice(0, 800);
    throw new Error(`dmx_http_${res.status}:${msg}`);
  }
  return parsed;
}

export function extractVideoId(submitJson: unknown): string {
  const root = asRecord(submitJson);
  const id = root?.id ?? asRecord(root?.output)?.id ?? asRecord(root?.data)?.id;
  if (typeof id === "string" && id.trim()) return id.trim();
  throw new Error("dmx_missing_task_id");
}

export function extractSeedanceTaskId(submitJson: unknown): string {
  const root = asRecord(submitJson);
  const id = root?.id;
  if (typeof id === "string" && id.trim()) return id.trim();
  throw new Error("dmx_missing_task_id");
}

function collectStrings(v: unknown, out: string[], depth = 0) {
  if (depth > 8) return;
  if (typeof v === "string") {
    out.push(v);
    return;
  }
  const r = asRecord(v);
  if (r) {
    for (const k of Object.keys(r)) collectStrings(r[k], out, depth + 1);
    return;
  }
  if (Array.isArray(v)) {
    for (const x of v) collectStrings(x, out, depth + 1);
  }
}

export function extractAnyVideoUrls(getJson: unknown): string[] {
  const strings: string[] = [];
  collectStrings(getJson, strings);
  const urls = strings
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => /https?:\/\/\S+/i.test(s))
    .flatMap((s) => s.split(/\s+/g))
    .map((s) => s.replace(/[),"'<>]+$/g, "").replace(/^[("'<>]+/g, ""))
    .filter((s) => /\.(mp4|webm)(\?|$)/i.test(s) || /video_url/i.test(s));
  // 兼容 video_url 这种不是纯 url 的情况：再单独抽取包含 mp4 的
  const mp4 = urls.filter((u) => /\.(mp4|webm)(\?|$)/i.test(u));
  const dedup = Array.from(new Set((mp4.length ? mp4 : urls).map(fixTosUrl)));
  return dedup;
}

export type SeedanceGetParsed =
  | { status: "queued" | "running" | "processing" }
  | { status: "succeeded"; videoUrl: string; rawStatus?: string }
  | { status: "failed"; message?: string; rawStatus?: string };

export function parseSeedanceGetResult(getJson: unknown): SeedanceGetParsed {
  const root = asRecord(getJson);
  const output = root?.output;
  if (!Array.isArray(output) || !output.length) {
    return { status: "processing" };
  }

  const msg = asRecord(output[0]);
  const content = msg?.content;
  if (!Array.isArray(content) || !content.length) {
    return { status: "processing" };
  }

  const part = asRecord(content[0]);
  const text = typeof part?.text === "string" ? part.text : "";
  if (!text.trim()) return { status: "processing" };

  let inner: unknown;
  try {
    inner = JSON.parse(text) as unknown;
  } catch {
    return { status: "processing" };
  }

  const innerObj = asRecord(inner);
  const statusRaw =
    typeof innerObj?.status === "string"
      ? innerObj.status
      : typeof asRecord(innerObj?.content)?.status === "string"
        ? String(asRecord(innerObj?.content)?.status)
        : "";

  const st = statusRaw.toLowerCase();
  if (st && (st.includes("queue") || st === "queued")) return { status: "queued" };
  if (st && (st.includes("run") || st === "running")) return { status: "running" };

  const contentObj = asRecord(innerObj?.content);
  const videoUrlRaw =
    typeof contentObj?.video_url === "string"
      ? contentObj.video_url
      : typeof innerObj?.video_url === "string"
        ? innerObj.video_url
        : "";

  if (typeof videoUrlRaw === "string" && videoUrlRaw.trim()) {
    return { status: "succeeded", videoUrl: fixTosUrl(videoUrlRaw.trim()), rawStatus: statusRaw || "succeeded" };
  }

  if (st.includes("fail")) {
    return { status: "failed", message: text.slice(0, 800), rawStatus: statusRaw };
  }

  return { status: "processing" };
}
