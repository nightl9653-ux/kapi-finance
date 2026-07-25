import type { MiscType } from "@/lib/banquet-party/types";

type HintLocale = "zh" | "en";

export function miscHintLocale(locale: string): HintLocale {
  return locale.startsWith("zh") ? "zh" : "en";
}

const MISC_TYPE_HINTS: Record<HintLocale, Record<MiscType, string>> = {
  zh: {
    favor: "宾客礼包、糖果盒、定制小物、回礼袋、伴手礼包装",
    service: "司仪、侍应、安保、化妆造型、礼仪引导、现场协调",
    venue: "场地费、桌椅租赁、帐篷、舞台搭建、贵宾休息室",
    media: "摄影、摄像、直播设备、快修、航拍、照片直播",
    print: "请柬、席位卡、节目单、定制包装、指引手册、签到册",
    entertainment: "DJ、乐队、魔术、互动主持、表演团队、小丑/人偶",
    logistics: "货运、停车、清洁、垃圾清运、搬运、冷藏车",
    deposit: "押金、小费、报批费、应急备用金、超时费",
    other: "保险、税费、未归类支出",
  },
  en: {
    favor: "Guest gift bags, candy boxes, custom keepsakes, favor packaging",
    service: "MC, waitstaff, security, makeup, ushers, day-of coordination",
    venue: "Venue fee, table/chair rental, tent, stage build, green room",
    media: "Photography, videography, live stream, same-day edit, drone, photo booth",
    print: "Invitations, place cards, programs, custom packaging, guides, guest book",
    entertainment: "DJ, band, magic, host, performers, mascot/character",
    logistics: "Freight, parking, cleaning, waste removal, movers, cold chain",
    deposit: "Deposits, tips, permits, contingency fund, overtime fees",
    other: "Insurance, taxes, uncategorized expenses",
  },
};

export function miscTypeHintText(locale: string, miscType: MiscType): string {
  return MISC_TYPE_HINTS[miscHintLocale(locale)][miscType];
}
