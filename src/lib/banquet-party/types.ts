import type { Currency } from "@/lib/fx";

export type { Currency };

export type PlantCategory =
  | "white"
  | "pink"
  | "red"
  | "purple"
  | "yellow"
  | "orange"
  | "green"
  | "neutral"
  | "dark";

export type PlantRole = "primary" | "secondary" | "accent" | "base";

export type MaterialCategory = "drink" | "food" | "decor" | "misc";

export type MenuCourse = "appetizer" | "snack" | "main" | "kids" | "dessert" | "drink";

/** @deprecated 旧杂费材质字段，加载时迁移为 miscType */
export type TextureTag = "metal" | "glossy" | "natural" | "transparent" | "soft";

export type MiscType =
  | "favor"
  | "service"
  | "venue"
  | "media"
  | "print"
  | "entertainment"
  | "logistics"
  | "deposit"
  | "other";

export type FoodFlavorTag =
  | "spicy"
  | "sweet"
  | "sour"
  | "light"
  | "lowSugar"
  | "lowOil"
  | "lowSalt"
  | "crispy"
  | "savory"
  | "numbing"
  | "rich"
  | "creamy"
  | "smoked"
  | "nourishing"
  | "medicinal"
  | "broth"
  | "vegetarian"
  | "halal"
  | "glutenFree";

export type DrinkType =
  | "aperitif"
  | "sparkling"
  | "whiteWine"
  | "redWine"
  | "spirit"
  | "cocktail"
  | "softDrink"
  | "water"
  | "coffeeTea"
  | "other";

export type DecorZone =
  | "entrance"
  | "table"
  | "photo"
  | "avLighting"
  | "overhead"
  | "floor"
  | "scentAir"
  | "wearable";

export type DecorAtmosphereTag =
  | "silk"
  | "metal"
  | "wood"
  | "glass"
  | "plush"
  | "paper"
  | "plastic"
  | "natural"
  | "pearl"
  | "diamond"
  | "agateMoonstone"
  | "platinumSilver"
  | "amberTurquoise"
  | "goldWhiteGold"
  | "gemInlay"
  | "leatherCoral"
  | "opalTourmalineSpinel";

export type CarouselImageType = "party" | "garden" | "jewelry";

export type CarouselImageSource = "magazine" | "movie" | "garden" | "user";

export interface Plant {
  id: string;
  name: string;
  nameEn: string;
  colorName: string;
  hex: string;
  role: PlantRole;
  category: PlantCategory;
}

export interface Material {
  id: string;
  name: string;
  quantity: number;
  price: number;
  category: MaterialCategory;
  plantColor: Plant;
  isPurchased: boolean;
  /** 装饰类：是否已布置到位 */
  isSetup?: boolean;
  /** 已写入记账的交易 id（实付对接） */
  transactionId?: string;
  /** 菜单分组：冷盘 / 主菜 / 甜点 / 饮品 */
  menuCourse?: MenuCourse;
  /** 食材口味，可多选（仅食材） */
  flavor?: FoodFlavorTag[];
  /** 酒水子类（仅酒水） */
  drinkType?: DrinkType;
  /** 装饰放置区域（仅装饰） */
  decorZone?: DecorZone;
  /** 装饰氛围标签，可多选（仅装饰） */
  decorAtmosphere?: DecorAtmosphereTag[];
  /** 杂费支出用途（仅杂费） */
  miscType?: MiscType;
  /** @deprecated 已迁移为 miscType */
  texture?: TextureTag;
  characterNote?: string;
}

export type GuestRsvp = "pending" | "confirmed" | "declined";

export interface Guest {
  id: string;
  name: string;
  count: number;
  rsvp: GuestRsvp;
  dietaryNotes?: string;
  tableLabel?: string;
  /** 联系方式：电话或邮箱（选填） */
  contact?: string;
  /** @deprecated 已合并为 contact */
  phone?: string;
  /** @deprecated 已合并为 contact */
  email?: string;
}

export interface TimelineTask {
  id: string;
  /** 预设任务 i18n key（timeline.task.*）；自定义任务可为空 */
  labelKey?: string;
  /** 自定义标题；有值时优先于 labelKey */
  label?: string;
  offsetDays: number;
  time?: string;
  done: boolean;
}

export type PartyDetailTab = "overview" | "aesthetics" | "prep" | "guests" | "timeline";

export type PrepSubTab = "budget" | "shopping" | "menu" | "decor" | "misc";

export interface ColorDistribution {
  plantId: string;
  percentage: number;
}

export interface ColorPalette {
  primary: Plant | null;
  secondaries: Plant[];
  accents: Plant[];
  distribution: ColorDistribution[];
}

export interface Party {
  id: string;
  name: string;
  date: string;
  characterId: string;
  /** Working currency for list amounts (ledger converts to USD base). */
  currency?: Currency;
  /** Optional planned spending ceiling in project currency */
  budgetCap?: number;
  /** 预设类型，如 daughterBirthday；custom 或空表示自定义 */
  partyTypeId?: string;
  materials: Material[];
  colorPalette: ColorPalette;
  guests?: Guest[];
  timeline?: TimelineTask[];
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
}

/** Supabase banquet_parties row */
export interface PartyRow {
  id: string;
  user_id: string;
  name: string;
  party_date: string;
  character_id: string;
  party_type_id: string | null;
  currency: string | null;
  budget_cap: number | string | null;
  materials: Material[];
  color_palette: ColorPalette | Record<string, unknown>;
  guests: Guest[];
  timeline: TimelineTask[];
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CarouselImage {
  id: string;
  url: string;
  source: CarouselImageSource;
  sourceName: string;
  plantIds: string[];
  dominantPlantId: string;
  tags: string[];
  type: CarouselImageType;
  /** CSS gradient when no image asset */
  gradient?: string;
}

export interface SoulCharacter {
  id: string;
  nameKey: string;
  styleKey: string;
  jewelryKey: string;
  attireKey: string;
  sceneKey: string;
  recommendedPlantIds: string[];
  emoji: string;
}
