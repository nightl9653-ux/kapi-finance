/** 为 Lemon Squeezy / 同类 Checkout 附加 user_id、pack_id（需在支付平台 webhook 回传或自定义字段读取） */
export function appendPackCheckoutMetadata(baseUrl: string, userId: string, packId: string): string {
  try {
    const u = new URL(baseUrl);
    u.searchParams.set("checkout[custom][user_id]", userId);
    u.searchParams.set("checkout[custom][pack_id]", packId);
    return u.href;
  } catch {
    return baseUrl;
  }
}
