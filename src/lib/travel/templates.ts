import { newTravelId, type TravelItem, type TravelItemCategory } from "@/lib/travel/types";

export type TravelTemplateId =
  | "dayOuting"
  | "cityDay"
  | "weekend"
  | "familyVisit"
  | "roadTrip"
  | "hiking"
  | "backpack"
  | "business"
  | "family"
  | "themePark"
  | "island"
  | "honeymoon";

/** once: 1. perPerson: 人数. perDay: 天数. perNight: 天数−1. perPersonDay: 人数×天数. */
export type TravelScale = "once" | "perPerson" | "perDay" | "perNight" | "perPersonDay";

type Seed = {
  nameKey: string;
  category: TravelItemCategory;
  amount: number;
  scale: TravelScale;
};

export type TravelTemplate = {
  id: TravelTemplateId;
  labelKey: string;
  defaultDays: number;
  defaultPeople: number;
  items: Seed[];
};

export const TRAVEL_TEMPLATES: TravelTemplate[] = [
  {
    id: "dayOuting",
    labelKey: "templateDayOuting",
    defaultDays: 1,
    defaultPeople: 2,
    items: [
      { nameKey: "roundTrip", category: "transport", amount: 50, scale: "perPerson" },
      { nameKey: "parking", category: "transport", amount: 15, scale: "perDay" },
      { nameKey: "lightMeals", category: "food", amount: 45, scale: "perPersonDay" },
      { nameKey: "snacks", category: "shopping", amount: 18, scale: "perPerson" },
      { nameKey: "outingTickets", category: "tickets", amount: 40, scale: "perPerson" },
      { nameKey: "lodging", category: "lodging", amount: 260, scale: "perNight" },
    ],
  },
  {
    id: "cityDay",
    labelKey: "templateCityDay",
    defaultDays: 1,
    defaultPeople: 1,
    items: [
      { nameKey: "cityTransit", category: "transport", amount: 15, scale: "perPerson" },
      { nameKey: "cityTaxi", category: "transport", amount: 50, scale: "perPerson" },
      { nameKey: "cityMeal", category: "food", amount: 150, scale: "perPersonDay" },
      { nameKey: "coffee", category: "food", amount: 35, scale: "perPerson" },
      { nameKey: "exhibition", category: "tickets", amount: 120, scale: "perPerson" },
      { nameKey: "cityShopping", category: "shopping", amount: 60, scale: "perPerson" },
      { nameKey: "lodging", category: "lodging", amount: 480, scale: "perNight" },
    ],
  },
  {
    id: "weekend",
    labelKey: "templateWeekend",
    defaultDays: 3,
    defaultPeople: 1,
    items: [
      { nameKey: "roundTrip", category: "transport", amount: 700, scale: "perPerson" },
      { nameKey: "localTransit", category: "transport", amount: 35, scale: "perPersonDay" },
      { nameKey: "lodging", category: "lodging", amount: 520, scale: "perNight" },
      { nameKey: "meals", category: "food", amount: 130, scale: "perPersonDay" },
      { nameKey: "tickets", category: "tickets", amount: 160, scale: "perPerson" },
      { nameKey: "insurance", category: "other", amount: 40, scale: "perPerson" },
      { nameKey: "simCard", category: "other", amount: 30, scale: "perPerson" },
      { nameKey: "souvenirs", category: "shopping", amount: 80, scale: "perPerson" },
      { nameKey: "buffer", category: "other", amount: 200, scale: "once" },
    ],
  },
  {
    id: "familyVisit",
    labelKey: "templateFamilyVisit",
    defaultDays: 4,
    defaultPeople: 2,
    items: [
      { nameKey: "visitTransport", category: "transport", amount: 420, scale: "perPerson" },
      { nameKey: "localTransit", category: "transport", amount: 20, scale: "perPersonDay" },
      { nameKey: "visitLodging", category: "lodging", amount: 220, scale: "perNight" },
      { nameKey: "homeBanquet", category: "food", amount: 480, scale: "once" },
      { nameKey: "visitMeals", category: "food", amount: 35, scale: "perPersonDay" },
      { nameKey: "visitGifts", category: "shopping", amount: 180, scale: "perPerson" },
      { nameKey: "fruitBox", category: "shopping", amount: 120, scale: "once" },
      { nameKey: "redPacket", category: "other", amount: 800, scale: "once" },
    ],
  },
  {
    id: "roadTrip",
    labelKey: "templateRoadTrip",
    defaultDays: 3,
    defaultPeople: 2,
    items: [
      { nameKey: "fuel", category: "transport", amount: 180, scale: "perDay" },
      { nameKey: "parking", category: "transport", amount: 25, scale: "perDay" },
      { nameKey: "guesthouse", category: "lodging", amount: 420, scale: "perNight" },
      { nameKey: "roadMeals", category: "food", amount: 75, scale: "perPersonDay" },
      { nameKey: "roadSnacks", category: "shopping", amount: 35, scale: "perPerson" },
      { nameKey: "roadTickets", category: "tickets", amount: 90, scale: "perPerson" },
      { nameKey: "insurance", category: "other", amount: 35, scale: "perPerson" },
      { nameKey: "carEmergency", category: "other", amount: 250, scale: "once" },
    ],
  },
  {
    id: "hiking",
    labelKey: "templateHiking",
    defaultDays: 3,
    defaultPeople: 2,
    items: [
      { nameKey: "trailTransport", category: "transport", amount: 160, scale: "perPerson" },
      { nameKey: "parkShuttle", category: "transport", amount: 30, scale: "perPerson" },
      { nameKey: "campsite", category: "lodging", amount: 100, scale: "perNight" },
      { nameKey: "trailMeals", category: "food", amount: 45, scale: "perPersonDay" },
      { nameKey: "drinkingWater", category: "food", amount: 8, scale: "perPersonDay" },
      { nameKey: "trailPermit", category: "tickets", amount: 50, scale: "perPerson" },
      { nameKey: "gearRental", category: "shopping", amount: 90, scale: "perPerson" },
      { nameKey: "insurance", category: "other", amount: 60, scale: "perPerson" },
      { nameKey: "firstAid", category: "other", amount: 40, scale: "once" },
    ],
  },
  {
    id: "backpack",
    labelKey: "templateBackpack",
    defaultDays: 5,
    defaultPeople: 1,
    items: [
      { nameKey: "backpackTransport", category: "transport", amount: 160, scale: "perPerson" },
      { nameKey: "localTransit", category: "transport", amount: 12, scale: "perPersonDay" },
      { nameKey: "hostel", category: "lodging", amount: 65, scale: "perNight" },
      { nameKey: "streetFood", category: "food", amount: 45, scale: "perPersonDay" },
      { nameKey: "budgetTickets", category: "tickets", amount: 35, scale: "perPerson" },
      { nameKey: "laundry", category: "other", amount: 20, scale: "perPerson" },
      { nameKey: "locker", category: "other", amount: 15, scale: "perPerson" },
      { nameKey: "insurance", category: "other", amount: 30, scale: "perPerson" },
      { nameKey: "buffer", category: "other", amount: 120, scale: "once" },
    ],
  },
  {
    id: "business",
    labelKey: "templateBusiness",
    defaultDays: 4,
    defaultPeople: 1,
    items: [
      { nameKey: "businessTransport", category: "transport", amount: 1400, scale: "perPerson" },
      { nameKey: "airportTransfer", category: "transport", amount: 100, scale: "perPerson" },
      { nameKey: "localTransit", category: "transport", amount: 50, scale: "perPersonDay" },
      { nameKey: "lodging", category: "lodging", amount: 650, scale: "perNight" },
      { nameKey: "workMeals", category: "food", amount: 90, scale: "perPersonDay" },
      { nameKey: "clientDinner", category: "food", amount: 600, scale: "once" },
      { nameKey: "laundry", category: "other", amount: 45, scale: "perPerson" },
      { nameKey: "roaming", category: "other", amount: 40, scale: "perPerson" },
      { nameKey: "printing", category: "other", amount: 30, scale: "once" },
      { nameKey: "buffer", category: "other", amount: 150, scale: "once" },
    ],
  },
  {
    id: "family",
    labelKey: "templateFamily",
    defaultDays: 5,
    defaultPeople: 3,
    items: [
      { nameKey: "familyTransport", category: "transport", amount: 850, scale: "perPerson" },
      { nameKey: "familyLocal", category: "transport", amount: 200, scale: "perDay" },
      { nameKey: "lodging", category: "lodging", amount: 760, scale: "perNight" },
      { nameKey: "meals", category: "food", amount: 70, scale: "perPersonDay" },
      { nameKey: "kidsSnacks", category: "food", amount: 15, scale: "perPersonDay" },
      { nameKey: "familyTickets", category: "tickets", amount: 240, scale: "perPerson" },
      { nameKey: "souvenirs", category: "shopping", amount: 70, scale: "perPerson" },
      { nameKey: "insurance", category: "other", amount: 30, scale: "perPerson" },
      { nameKey: "sharedSupplies", category: "shopping", amount: 160, scale: "once" },
      { nameKey: "buffer", category: "other", amount: 300, scale: "once" },
    ],
  },
  {
    id: "themePark",
    labelKey: "templateThemePark",
    defaultDays: 3,
    defaultPeople: 3,
    items: [
      { nameKey: "roundTrip", category: "transport", amount: 360, scale: "perPerson" },
      { nameKey: "parking", category: "transport", amount: 40, scale: "perDay" },
      { nameKey: "parkHotel", category: "lodging", amount: 860, scale: "perNight" },
      { nameKey: "parkMeals", category: "food", amount: 85, scale: "perPersonDay" },
      { nameKey: "parkSnacks", category: "food", amount: 35, scale: "perPerson" },
      { nameKey: "parkTickets", category: "tickets", amount: 500, scale: "perPerson" },
      { nameKey: "expressPass", category: "tickets", amount: 160, scale: "perPerson" },
      { nameKey: "stroller", category: "other", amount: 40, scale: "perDay" },
      { nameKey: "parkSouvenirs", category: "shopping", amount: 100, scale: "perPerson" },
      { nameKey: "parkPhotos", category: "shopping", amount: 90, scale: "once" },
    ],
  },
  {
    id: "island",
    labelKey: "templateIsland",
    defaultDays: 5,
    defaultPeople: 2,
    items: [
      { nameKey: "islandTransport", category: "transport", amount: 1000, scale: "perPerson" },
      { nameKey: "islandTransfer", category: "transport", amount: 160, scale: "once" },
      { nameKey: "seaHotel", category: "lodging", amount: 960, scale: "perNight" },
      { nameKey: "resortFee", category: "lodging", amount: 60, scale: "perNight" },
      { nameKey: "meals", category: "food", amount: 130, scale: "perPersonDay" },
      { nameKey: "islandActivity", category: "tickets", amount: 260, scale: "perPerson" },
      { nameKey: "gearRental", category: "tickets", amount: 50, scale: "perPerson" },
      { nameKey: "islandShopping", category: "shopping", amount: 150, scale: "perPerson" },
      { nameKey: "insurance", category: "other", amount: 70, scale: "perPerson" },
      { nameKey: "simCard", category: "other", amount: 35, scale: "perPerson" },
    ],
  },
  {
    id: "honeymoon",
    labelKey: "templateHoneymoon",
    defaultDays: 6,
    defaultPeople: 2,
    items: [
      { nameKey: "honeymoonFlight", category: "transport", amount: 3200, scale: "perPerson" },
      { nameKey: "privateTransfer", category: "transport", amount: 360, scale: "once" },
      { nameKey: "honeymoonHotel", category: "lodging", amount: 1500, scale: "perNight" },
      { nameKey: "fineDining", category: "food", amount: 260, scale: "perPersonDay" },
      { nameKey: "spaExperience", category: "tickets", amount: 380, scale: "perPerson" },
      { nameKey: "couplePhoto", category: "tickets", amount: 680, scale: "once" },
      { nameKey: "honeymoonGifts", category: "shopping", amount: 350, scale: "perPerson" },
      { nameKey: "honeymoonSurprise", category: "shopping", amount: 260, scale: "once" },
      { nameKey: "visaFee", category: "other", amount: 350, scale: "perPerson" },
      { nameKey: "insurance", category: "other", amount: 90, scale: "perPerson" },
      { nameKey: "simCard", category: "other", amount: 40, scale: "perPerson" },
      { nameKey: "honeymoonTips", category: "other", amount: 60, scale: "perNight" },
    ],
  },
];

export function getTravelTemplate(id: TravelTemplateId): TravelTemplate {
  return TRAVEL_TEMPLATES.find((t) => t.id === id) ?? TRAVEL_TEMPLATES[0];
}

export function clampTripDays(value: number, fallback = 1): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(60, Math.max(1, Math.round(value)));
}

export function clampPartySize(value: number, fallback = 1): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(30, Math.max(1, Math.round(value)));
}

export function nightsFromDays(days: number): number {
  return Math.max(0, clampTripDays(days) - 1);
}

export function quantityForScale(scale: TravelScale, days: number, people: number): number {
  const d = clampTripDays(days);
  const p = clampPartySize(people);
  switch (scale) {
    case "once":
      return 1;
    case "perPerson":
      return p;
    case "perDay":
      return d;
    case "perNight":
      return nightsFromDays(d);
    case "perPersonDay":
      return d * p;
  }
}

export function itemsFromTemplate(
  templateId: TravelTemplateId,
  options: { days: number; people: number },
  label: (nameKey: string) => string,
): TravelItem[] {
  const tpl = getTravelTemplate(templateId);
  const items: TravelItem[] = [];
  for (const seed of tpl.items) {
    const quantity = quantityForScale(seed.scale, options.days, options.people);
    if (quantity < 1) continue;
    items.push({
      id: newTravelId(),
      name: label(seed.nameKey),
      category: seed.category,
      amount: seed.amount,
      quantity,
    });
  }
  return items;
}
