function getCreemApiKey(): string | null {
  return process.env.CREEM_API_KEY?.trim() || null;
}

function creemApiBaseUrl(apiKey: string): string {
  return apiKey.startsWith("creem_test_") ? "https://test-api.creem.io" : "https://api.creem.io";
}

export function isCreemCheckoutApiConfigured(): boolean {
  return Boolean(getCreemApiKey());
}

export type CreateCreemCheckoutParams = {
  productId: string;
  units: number;
  successUrl: string;
  requestId?: string;
  metadata: Record<string, string>;
  customerEmail?: string;
};

export type CreemCheckoutSession =
  | { ok: true; checkoutId: string; checkoutUrl: string }
  | { ok: false; error: string };

function readCheckoutUrl(body: Record<string, unknown>): { id: string; url: string } | null {
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const url =
    (typeof body.checkout_url === "string" && body.checkout_url.trim()) ||
    (typeof body.checkoutUrl === "string" && body.checkoutUrl.trim()) ||
    (typeof body.url === "string" && body.url.trim()) ||
    "";
  if (!url) return null;
  try {
    new URL(url);
  } catch {
    return null;
  }
  return { id: id || url, url };
}

/** Creem Checkout API???? N ??????? = ?? ? units? */
export async function createCreemCheckout(params: CreateCreemCheckoutParams): Promise<CreemCheckoutSession> {
  const apiKey = getCreemApiKey();
  if (!apiKey) return { ok: false, error: "creem_api_not_configured" };

  const productId = params.productId.trim();
  if (!productId) return { ok: false, error: "product_missing" };
  if (!Number.isInteger(params.units) || params.units < 1) return { ok: false, error: "invalid_units" };

  const payload: Record<string, unknown> = {
    product_id: productId,
    success_url: params.successUrl,
    metadata: params.metadata,
  };
  if (params.units > 1) payload.units = params.units;
  if (params.requestId) payload.request_id = params.requestId;
  if (params.customerEmail) payload.customer = { email: params.customerEmail };

  let res: Response;
  try {
    res = await fetch(`${creemApiBaseUrl(apiKey)}/v1/checkouts`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return { ok: false, error: "creem_unreachable" };
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  if (!res.ok) {
    const detail =
      (typeof body.message === "string" && body.message.trim()) ||
      (typeof body.error === "string" && body.error.trim()) ||
      "";
    const safe = detail.replace(/\s+/g, " ").slice(0, 160);
    return { ok: false, error: safe ? `creem_checkout_failed:${safe}` : "creem_checkout_failed" };
  }

  const parsed = readCheckoutUrl(body);
  if (!parsed) return { ok: false, error: "creem_checkout_url_missing" };
  return { ok: true, checkoutId: parsed.id, checkoutUrl: parsed.url };
}
