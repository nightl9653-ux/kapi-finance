import type { DecorWearableHintGroup } from "@/lib/banquet-party/decor";
import type { DecorZone } from "@/lib/banquet-party/types";

type HintLocale = "zh" | "en";

export function decorHintLocale(locale: string): HintLocale {
  return locale.startsWith("zh") ? "zh" : "en";
}

const DECOR_ZONE_HINTS: Record<HintLocale, Record<Exclude<DecorZone, "wearable">, string>> = {
  zh: {
    entrance: "迎宾牌、签到台、欢迎花艺、气球柱、地毯、拱门/花门、指引牌、伴手礼展示台",
    table: "桌布、餐巾、餐具、烛台、中心花艺、座位卡、餐巾环、桌旗、桌号牌、甜品架、酒具",
    photo: "背景板、手持道具、自拍镜、主题相框、拍立得墙、手举牌、绿幕",
    avLighting:
      "音响/音箱、麦克风/话筒、调音台/DJ台、投影机、LED屏/电视、投影幕、舞台灯光、追光灯、帕灯、灯带/灯串、激光灯、烟雾机、控台、迎宾屏/导视屏",
    overhead: "吊顶花艺、悬挂气球、吊灯装饰、彩带、纸艺挂饰、拉旗横幅",
    floor: "地毯、散落气球、落地花艺、礼物堆、儿童游戏角、花瓣路、懒人沙发、展示台",
    scentAir: "精油扩香机、香薰蜡烛、藤条香薰、线香/塔香、香氛喷雾、加湿器、电风扇、循环扇、排风扇/通风机、空气净化器",
  },
  en: {
    entrance: "Welcome sign, check-in desk, welcome florals, balloon columns, rug, arch/floral gate, wayfinding signs, favor display",
    table: "Tablecloth, napkins, tableware, candles, centerpieces, place cards, napkin rings, runners, table numbers, dessert stands, barware",
    photo: "Backdrop, hand props, selfie mirror, themed frames, Polaroid wall, hand signs, green screen",
    avLighting:
      "Speakers, mics, mixer/DJ booth, projector, LED wall/TV, projection screen, stage lights, spotlights, PAR cans, light strips, laser, fog machine, control desk, welcome screens",
    overhead: "Ceiling florals, hanging balloons, pendant decor, ribbons, paper hangings, banners",
    floor: "Rugs, scattered balloons, floor florals, gift pile, kids play corner, petal aisle, floor cushions, display plinths",
    scentAir: "Diffusers, scented candles, reed diffusers, incense, room spray, humidifier, fans, circulators, exhaust/vent fans, air purifiers",
  },
};

const WEARABLE_GROUP_LABELS: Record<HintLocale, Record<DecorWearableHintGroup, string>> = {
  zh: { headwear: "头饰", jewelry: "首饰", handheld: "手持", apparel: "服饰" },
  en: { headwear: "Headwear", jewelry: "Jewelry", handheld: "Handheld", apparel: "Apparel" },
};

const WEARABLE_GROUP_ITEMS: Record<HintLocale, Record<DecorWearableHintGroup, string>> = {
  zh: {
    headwear: "派对帽、皇冠、拍照头饰、面具、头纱、额饰、花环、假发",
    jewelry: "胸花、腕花、项链、耳环、手链、胸针、戒指",
    handheld: "手杖、扇子、手套、烟斗、魔杖、闪光棒",
    apparel: "贴纸、披肩、领结、缎带、纹身贴",
  },
  en: {
    headwear: "Party hats, crowns, photo headpieces, masks, veils, forehead pieces, garlands, wigs",
    jewelry: "Corsages, wrist flowers, necklaces, earrings, bracelets, brooches, rings",
    handheld: "Canes, fans, gloves, pipes, wands, glow sticks",
    apparel: "Stickers, shawls, bow ties, ribbons, temporary tattoos",
  },
};

export function decorZoneHintText(locale: string, zone: Exclude<DecorZone, "wearable">): string {
  return DECOR_ZONE_HINTS[decorHintLocale(locale)][zone];
}

export function decorWearableHintGroupLabelText(locale: string, group: DecorWearableHintGroup): string {
  return WEARABLE_GROUP_LABELS[decorHintLocale(locale)][group];
}

export function decorWearableHintGroupItemsText(locale: string, group: DecorWearableHintGroup): string {
  return WEARABLE_GROUP_ITEMS[decorHintLocale(locale)][group];
}
