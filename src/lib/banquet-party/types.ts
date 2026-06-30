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

export type TextureTag = "metal" | "glossy" | "natural" | "transparent" | "soft";

export type FoodFlavorTag =
  | "spicy"
  | "sweet"
  | "sour"
  | "light"
  | "lowSugar"
  | "lowOil"
  | "crispy"
  | "nourishing"
  | "medicinal"
  | "broth";

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
  /** 菜单分组：冷盘 / 主菜 / 甜点 / 饮品 */
  menuCourse?: MenuCourse;
  /** 食材/酒水口味（仅食材） */
  flavor?: FoodFlavorTag;
  /** 酒水子类（仅酒水） */
  drinkType?: DrinkType;
  /** 装饰/杂费材质 */
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
}

export interface TimelineTask {
  id: string;
  labelKey: string;
  offsetDays: number;
  time?: string;
  done: boolean;
}

export type PartyDetailTab = "overview" | "aesthetics" | "prep" | "guests" | "timeline";

export type PrepSubTab = "budget" | "shopping" | "menu" | "decor";

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
  /** 预设类型，如 daughterBirthday；custom 或空表示自定义 */
  partyTypeId?: string;
  materials: Material[];
  colorPalette: ColorPalette;
  guests?: Guest[];
  timeline?: TimelineTask[];
  createdAt: string;
  completedAt?: string;
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
