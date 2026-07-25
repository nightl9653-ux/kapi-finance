import type { DecorAtmosphereTag, DecorZone, DrinkType, FoodFlavorTag, MaterialCategory, MenuCourse, MiscType } from "@/lib/banquet-party/types";

export interface PartyMaterialTemplate {
  nameKey: string;
  category: MaterialCategory;
  plantId: string;
  quantity: number;
  price: number;
  miscType?: MiscType;
  flavor?: FoodFlavorTag[];
  drinkType?: DrinkType;
  decorZone?: DecorZone;
  decorAtmosphere?: DecorAtmosphereTag[];
  menuCourse?: MenuCourse;
}

export interface PartyTemplate {
  id: string;
  nameKey: string;
  descKey: string;
  characterId: string;
  materials: PartyMaterialTemplate[];
}

/** 精选模板：卡片展示，保留原始预填细节 */
export const FEATURED_PARTY_TEMPLATES: PartyTemplate[] = [
  {
    id: "daughterBirthday",
    nameKey: "daughterBirthday",
    descKey: "daughterBirthdayDesc",
    characterId: "luna",
    materials: [
      { nameKey: "pinkBalloons", category: "decor", plantId: "achillea_filipendulina", quantity: 1, price: 88, decorZone: "overhead", decorAtmosphere: ["plastic"] },
      { nameKey: "birthdayCake", category: "food", plantId: "verbena_bonariensis", quantity: 1, price: 268, flavor: ["sweet"], menuCourse: "dessert" },
      { nameKey: "tableFlowers", category: "decor", plantId: "lycoris_radiata", quantity: 1, price: 120, decorZone: "table", decorAtmosphere: ["natural"] },
      { nameKey: "sparklingJuice", category: "drink", plantId: "briza_maxima", quantity: 6, price: 12, drinkType: "softDrink", menuCourse: "drink" },
      { nameKey: "partyFavors", category: "misc", plantId: "cortaderia_pumila", quantity: 10, price: 15, miscType: "favor" },
    ],
  },
  {
    id: "gardenDinner",
    nameKey: "gardenDinner",
    descKey: "gardenDinnerDesc",
    characterId: "amal",
    materials: [
      { nameKey: "outdoorLights", category: "decor", plantId: "rudbeckia", quantity: 1, price: 199, decorAtmosphere: ["metal"] },
      { nameKey: "seasonalBouquet", category: "decor", plantId: "helenium", quantity: 2, price: 80, decorAtmosphere: ["natural"] },
    ],
  },
  {
    id: "networkingSalon",
    nameKey: "networkingSalon",
    descKey: "networkingSalonDesc",
    characterId: "margot",
    materials: [
      { nameKey: "cocktailReception", category: "drink", plantId: "liatris_spicata", quantity: 15, price: 68, drinkType: "cocktail", menuCourse: "drink" },
      { nameKey: "networkingCanapes", category: "food", plantId: "lychnis_coronaria", quantity: 1, price: 580, flavor: ["light"], menuCourse: "appetizer" },
      { nameKey: "loungeDecor", category: "decor", plantId: "prunus_nigra", quantity: 1, price: 420, decorZone: "table", decorAtmosphere: ["silk", "metal"] },
      { nameKey: "networkHost", category: "misc", plantId: "thalictrum", quantity: 1, price: 1200, miscType: "service" },
    ],
  },
];

/** 更多推荐：下拉选择 */
export const EXTENDED_PARTY_TEMPLATES: PartyTemplate[] = [
  {
    id: "wedding",
    nameKey: "wedding",
    descKey: "weddingDesc",
    characterId: "jasmine",
    materials: [
      { nameKey: "welcomeFlorals", category: "decor", plantId: "veronicastrum_album", quantity: 1, price: 380, decorZone: "entrance", decorAtmosphere: ["natural", "pearl"] },
      { nameKey: "tableCenterpiece", category: "decor", plantId: "helenium", quantity: 10, price: 85, decorZone: "table", decorAtmosphere: ["natural"] },
      { nameKey: "sparklingToast", category: "drink", plantId: "briza_maxima", quantity: 12, price: 48, drinkType: "sparkling", menuCourse: "drink" },
      { nameKey: "weddingInvitations", category: "misc", plantId: "jacobaea_maritima", quantity: 1, price: 680, miscType: "print" },
    ],
  },
  {
    id: "longevityBanquet",
    nameKey: "longevityBanquet",
    descKey: "longevityBanquetDesc",
    characterId: "daisy",
    materials: [
      { nameKey: "longevityNoodles", category: "food", plantId: "rudbeckia", quantity: 1, price: 288, flavor: ["nourishing"], menuCourse: "main" },
      { nameKey: "peachBunDessert", category: "food", plantId: "verbena_bonariensis", quantity: 1, price: 168, flavor: ["sweet", "lowSugar"], menuCourse: "dessert" },
      { nameKey: "teaService", category: "drink", plantId: "scabiosa", quantity: 1, price: 120, drinkType: "coffeeTea", menuCourse: "drink" },
      { nameKey: "tableFlorals", category: "decor", plantId: "echinacea_pallida", quantity: 1, price: 260, decorZone: "table", decorAtmosphere: ["natural"] },
    ],
  },
  {
    id: "fullMoon",
    nameKey: "fullMoon",
    descKey: "fullMoonDesc",
    characterId: "luna",
    materials: [
      { nameKey: "redEggFavors", category: "misc", plantId: "papaver_rhoeas", quantity: 30, price: 3, miscType: "favor" },
      { nameKey: "balloonGarland", category: "decor", plantId: "achillea_filipendulina", quantity: 1, price: 128, decorZone: "overhead", decorAtmosphere: ["plastic"] },
      { nameKey: "sweetSoup", category: "food", plantId: "verbena_bonariensis", quantity: 1, price: 88, flavor: ["sweet"], menuCourse: "dessert" },
    ],
  },
  {
    id: "knightParty",
    nameKey: "knightParty",
    descKey: "knightPartyDesc",
    characterId: "charlotte",
    materials: [
      { nameKey: "knightBalloons", category: "decor", plantId: "rudbeckia", quantity: 1, price: 88, decorZone: "overhead", decorAtmosphere: ["plastic", "metal"] },
      { nameKey: "knightBirthdayCake", category: "food", plantId: "kniphofia_uvaria", quantity: 1, price: 268, flavor: ["sweet"], menuCourse: "dessert" },
      { nameKey: "knightBanner", category: "decor", plantId: "solidago_goldenmosa", quantity: 1, price: 120, decorZone: "photo", decorAtmosphere: ["paper", "metal"] },
      { nameKey: "sparklingJuice", category: "drink", plantId: "briza_maxima", quantity: 6, price: 12, drinkType: "softDrink", menuCourse: "drink" },
      { nameKey: "knightFavors", category: "misc", plantId: "aster_twilight", quantity: 10, price: 18, miscType: "favor" },
    ],
  },
  {
    id: "housewarming",
    nameKey: "housewarming",
    descKey: "housewarmingDesc",
    characterId: "amal",
    materials: [
      { nameKey: "entranceWreath", category: "decor", plantId: "nassella_tenuissima", quantity: 1, price: 150, decorZone: "entrance", decorAtmosphere: ["natural"] },
      { nameKey: "housewarmingFeast", category: "food", plantId: "pennisetum", quantity: 1, price: 688, flavor: ["savory"], menuCourse: "main" },
      { nameKey: "houseWine", category: "drink", plantId: "briza_maxima", quantity: 6, price: 68, drinkType: "redWine", menuCourse: "drink" },
    ],
  },
  {
    id: "engagement",
    nameKey: "engagement",
    descKey: "engagementDesc",
    characterId: "margot",
    materials: [
      { nameKey: "photoBackdrop", category: "decor", plantId: "lychnis_coronaria", quantity: 1, price: 420, decorZone: "photo", decorAtmosphere: ["silk", "pearl"] },
      { nameKey: "aperitifDrinks", category: "drink", plantId: "liatris_spicata", quantity: 8, price: 38, drinkType: "aperitif", menuCourse: "drink" },
      { nameKey: "engagementFavors", category: "misc", plantId: "prunus_nigra", quantity: 20, price: 18, miscType: "favor" },
    ],
  },
  {
    id: "corporate",
    nameKey: "corporate",
    descKey: "corporateDesc",
    characterId: "charlotte",
    materials: [
      { nameKey: "signageDisplay", category: "decor", plantId: "jacobaea_maritima", quantity: 1, price: 320, decorZone: "entrance", decorAtmosphere: ["metal", "glass"] },
      { nameKey: "buffetSpread", category: "food", plantId: "veronicastrum_album", quantity: 1, price: 1280, flavor: ["light"], menuCourse: "main" },
      { nameKey: "coffeeBreak", category: "drink", plantId: "scabiosa", quantity: 1, price: 260, drinkType: "coffeeTea", menuCourse: "drink" },
      { nameKey: "mcService", category: "misc", plantId: "thalictrum", quantity: 1, price: 800, miscType: "service" },
    ],
  },
  {
    id: "graduationBanquet",
    nameKey: "graduationBanquet",
    descKey: "graduationBanquetDesc",
    characterId: "charlotte",
    materials: [
      { nameKey: "graduationFeast", category: "food", plantId: "solidago_goldenmosa", quantity: 1, price: 888, flavor: ["savory"], menuCourse: "main" },
      { nameKey: "graduationSparkling", category: "drink", plantId: "briza_maxima", quantity: 10, price: 58, drinkType: "sparkling", menuCourse: "drink" },
      { nameKey: "graduationProgram", category: "misc", plantId: "jacobaea_maritima", quantity: 1, price: 280, miscType: "print" },
      { nameKey: "graduationFlorals", category: "decor", plantId: "echinacea_pallida", quantity: 1, price: 320, decorZone: "entrance", decorAtmosphere: ["natural"] },
    ],
  },
  {
    id: "thankYouBanquet",
    nameKey: "thankYouBanquet",
    descKey: "thankYouBanquetDesc",
    characterId: "jasmine",
    materials: [
      { nameKey: "thankYouFlorals", category: "decor", plantId: "helenium", quantity: 1, price: 360, decorZone: "table", decorAtmosphere: ["natural", "pearl"] },
      { nameKey: "thankYouFeast", category: "food", plantId: "veronicastrum_album", quantity: 1, price: 980, flavor: ["savory", "light"], menuCourse: "main" },
      { nameKey: "thankYouGifts", category: "misc", plantId: "prunus_nigra", quantity: 20, price: 48, miscType: "favor" },
      { nameKey: "thankYouWine", category: "drink", plantId: "scabiosa", quantity: 6, price: 128, drinkType: "redWine", menuCourse: "drink" },
    ],
  },
  {
    id: "classReunion",
    nameKey: "classReunion",
    descKey: "classReunionDesc",
    characterId: "amal",
    materials: [
      { nameKey: "reunionBackdrop", category: "decor", plantId: "kniphofia_uvaria", quantity: 1, price: 380, decorZone: "photo", decorAtmosphere: ["paper"] },
      { nameKey: "reunionSnacks", category: "food", plantId: "pennisetum", quantity: 1, price: 468, flavor: ["crispy"], menuCourse: "snack" },
      { nameKey: "reunionDrinks", category: "drink", plantId: "liatris_spicata", quantity: 12, price: 35, drinkType: "cocktail", menuCourse: "drink" },
      { nameKey: "reunionAlbum", category: "misc", plantId: "aster_twilight", quantity: 1, price: 220, miscType: "print" },
    ],
  },
  {
    id: "blessingBanquet",
    nameKey: "blessingBanquet",
    descKey: "blessingBanquetDesc",
    characterId: "luna",
    materials: [
      { nameKey: "blessingAltarFlorals", category: "decor", plantId: "salvia_uliginosa", quantity: 1, price: 280, decorZone: "entrance", decorAtmosphere: ["natural"] },
      { nameKey: "incenseDiffuser", category: "decor", plantId: "thalictrum", quantity: 2, price: 88, decorZone: "scentAir", decorAtmosphere: ["natural"] },
      { nameKey: "vegetarianOfferings", category: "food", plantId: "jacobaea_maritima", quantity: 1, price: 388, flavor: ["light", "vegetarian"], menuCourse: "main" },
      { nameKey: "blessingDonation", category: "misc", plantId: "briza_maxima", quantity: 1, price: 200, miscType: "deposit" },
    ],
  },
  {
    id: "communityWelcome",
    nameKey: "communityWelcome",
    descKey: "communityWelcomeDesc",
    characterId: "amal",
    materials: [
      { nameKey: "communityWelcomeDecor", category: "decor", plantId: "nassella_tenuissima", quantity: 1, price: 260, decorZone: "entrance", decorAtmosphere: ["natural"] },
      { nameKey: "neighborRefreshments", category: "food", plantId: "pennisetum", quantity: 1, price: 320, flavor: ["light"], menuCourse: "snack" },
      { nameKey: "welcomeTea", category: "drink", plantId: "scabiosa", quantity: 1, price: 88, drinkType: "coffeeTea", menuCourse: "drink" },
      { nameKey: "neighborHandbook", category: "misc", plantId: "jacobaea_maritima", quantity: 1, price: 150, miscType: "print" },
      { nameKey: "welcomeGiftBag", category: "misc", plantId: "cortaderia_pumila", quantity: 20, price: 25, miscType: "favor" },
    ],
  },
  {
    id: "sportsBuddyMeet",
    nameKey: "sportsBuddyMeet",
    descKey: "sportsBuddyMeetDesc",
    characterId: "amal",
    materials: [
      { nameKey: "sportsBackdrop", category: "decor", plantId: "kniphofia_uvaria", quantity: 1, price: 280, decorZone: "photo", decorAtmosphere: ["plastic", "paper"] },
      { nameKey: "teamSnacks", category: "food", plantId: "pennisetum", quantity: 1, price: 368, flavor: ["crispy"], menuCourse: "snack" },
      { nameKey: "sportsDrinks", category: "drink", plantId: "briza_maxima", quantity: 12, price: 8, drinkType: "softDrink", menuCourse: "drink" },
      { nameKey: "sportsBanners", category: "decor", plantId: "solidago_goldenmosa", quantity: 2, price: 65, decorZone: "overhead", decorAtmosphere: ["plastic"] },
      { nameKey: "teamSouvenirs", category: "misc", plantId: "aster_twilight", quantity: 12, price: 22, miscType: "favor" },
    ],
  },
  {
    id: "custom",
    nameKey: "custom",
    descKey: "customDesc",
    characterId: "charlotte",
    materials: [],
  },
];

export const PARTY_TEMPLATES: PartyTemplate[] = [...FEATURED_PARTY_TEMPLATES, ...EXTENDED_PARTY_TEMPLATES];

export const FEATURED_PARTY_TEMPLATE_IDS = new Set(FEATURED_PARTY_TEMPLATES.map((t) => t.id));

export function isFeaturedPartyTemplate(id: string): boolean {
  return FEATURED_PARTY_TEMPLATE_IDS.has(id);
}

export function getPartyTemplate(id: string): PartyTemplate | undefined {
  return PARTY_TEMPLATES.find((t) => t.id === id);
}
