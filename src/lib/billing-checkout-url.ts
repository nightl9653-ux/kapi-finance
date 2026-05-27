/** 为 Lemon Squeezy / 同类 Checkout 附加 user_id、pack_id（需在支付平台 webhook 回传或自定义字段读取） */
export function appendPackCheckoutMetadata(baseUrl: string, userId: string, packId: string): string {
  return appendBillingCheckoutMetadata(baseUrl, { user_id: userId, pack_id: packId });
}

/** Plus 订阅 Checkout：自定义字段 `user_id` + `plan_id` */
export function appendPlusCheckoutMetadata(baseUrl: string, userId: string, planId: string): string {
  return appendBillingCheckoutMetadata(baseUrl, { user_id: userId, plan_id: planId });
}

function appendBillingCheckoutMetadata(baseUrl: string, fields: Record<string, string>): string {
  try {
    const u = new URL(baseUrl);
    const isCreem = u.hostname.includes("creem.io");
    for (const [key, value] of Object.entries(fields)) {
      if (!value) continue;
      // Creem: https://docs.creem.io — metadata[user_id]=...
      if (isCreem) {
        u.searchParams.set(`metadata[${key}]`, value);
      } else {
        // Lemon Squeezy 等
        u.searchParams.set(`checkout[custom][${key}]`, value);
      }
    }
    return u.href;
  } catch {
    return baseUrl;
  }
}
