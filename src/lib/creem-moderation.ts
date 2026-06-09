/** Creem Moderation API — required before AI image/video generation (Merchant of Record). */

export const creemPromptRejectedError = "prompt_rejected" as const;
export const creemModerationUnavailableError = "moderation_unavailable" as const;
export const creemModerationNotConfiguredError = "moderation_not_configured" as const;

type ModerationDecision = "allow" | "flag" | "deny";

type ModerationResponse = {
  decision?: ModerationDecision;
};

function getCreemApiKey(): string | null {
  return process.env.CREEM_API_KEY?.trim() || null;
}

function creemModerationBaseUrl(apiKey: string): string {
  return apiKey.startsWith("creem_test_") ? "https://test-api.creem.io" : "https://api.creem.io";
}

/**
 * Screen a prompt before routing to an image/video model.
 * Blocks on `deny` and `flag`. Fails closed if the API is unavailable.
 */
export async function assertCreemPromptAllowed(params: {
  prompt: string;
  externalId?: string;
}): Promise<void> {
  const prompt = params.prompt.trim();
  if (!prompt) return;

  const apiKey = getCreemApiKey();
  if (!apiKey) {
    throw new Error(creemModerationNotConfiguredError);
  }

  const url = `${creemModerationBaseUrl(apiKey)}/v1/moderation/prompt`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        ...(params.externalId ? { external_id: params.externalId } : {}),
      }),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
  } catch {
    throw new Error(creemModerationUnavailableError);
  }

  if (!res.ok) {
    throw new Error(creemModerationUnavailableError);
  }

  let body: ModerationResponse;
  try {
    body = (await res.json()) as ModerationResponse;
  } catch {
    throw new Error(creemModerationUnavailableError);
  }

  if (body.decision === "deny" || body.decision === "flag") {
    throw new Error(creemPromptRejectedError);
  }
}

/** User-authored dream inputs (keywords, notes) before LLM prompt expansion. */
export async function assertCreemUserInputsAllowed(params: {
  parts: Array<string | null | undefined>;
  externalId?: string;
}): Promise<void> {
  const combined = params.parts
    .map((p) => String(p ?? "").trim())
    .filter(Boolean)
    .join("\n");
  if (!combined) return;
  await assertCreemPromptAllowed({ prompt: combined, externalId: params.externalId });
}
