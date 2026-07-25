import type { MaterialCategory, ProjectPhase, ProjectType, RenovationRoom, SupplyType } from "@/lib/house-renovation/types";

export interface ProjectMaterialTemplate {
  nameKey: string;
  category: MaterialCategory;
  phase: ProjectPhase;
  quantity: number;
  price: number;
  room?: RenovationRoom;
  supplyType?: SupplyType;
}

export interface ProjectTemplate {
  id: string;
  projectType: ProjectType;
  nameKey: string;
  descKey: string;
  materials: ProjectMaterialTemplate[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "fullRenovation",
    projectType: "renovation",
    nameKey: "fullRenovation",
    descKey: "fullRenovationDesc",
    materials: [
      { nameKey: "designFee", category: "labor", phase: "demolition", quantity: 1, price: 12000, supplyType: "laborOnly" },
      { nameKey: "demolitionWork", category: "labor", phase: "demolition", quantity: 1, price: 3500, supplyType: "laborOnly" },
      { nameKey: "plumbingElectrical", category: "structure", phase: "plumbingElectrical", quantity: 1, price: 12000, supplyType: "turnkey" },
      { nameKey: "floorTiles", category: "finishes", phase: "carpentryMasonry", quantity: 25, price: 120, room: "kitchen", supplyType: "selfPurchase" },
      { nameKey: "woodFlooring", category: "finishes", phase: "carpentryMasonry", quantity: 55, price: 220, room: "living", supplyType: "selfPurchase" },
      { nameKey: "customWardrobes", category: "finishes", phase: "carpentryMasonry", quantity: 1, price: 18000, room: "whole", supplyType: "turnkey" },
      { nameKey: "doorsWindows", category: "finishes", phase: "installation", quantity: 1, price: 16800, room: "whole", supplyType: "selfPurchase" },
      { nameKey: "interiorPaint", category: "finishes", phase: "painting", quantity: 1, price: 6500, supplyType: "laborOnly" },
      { nameKey: "kitchenAppliances", category: "appliances", phase: "installation", quantity: 1, price: 28000, room: "kitchen", supplyType: "selfPurchase" },
      { nameKey: "bathroomFixtures", category: "appliances", phase: "installation", quantity: 1, price: 8800, room: "bathroom", supplyType: "selfPurchase" },
      { nameKey: "lightingPackage", category: "furnishing", phase: "installation", quantity: 1, price: 4200, supplyType: "selfPurchase" },
      { nameKey: "sofaSet", category: "furnishing", phase: "furnishing", quantity: 1, price: 9800, room: "living", supplyType: "selfPurchase" },
      { nameKey: "wasteRemoval", category: "misc", phase: "demolition", quantity: 1, price: 1200, supplyType: "laborOnly" },
      { nameKey: "miscSupplies", category: "misc", phase: "installation", quantity: 1, price: 1800, room: "whole", supplyType: "selfPurchase" },
    ],
  },
  {
    id: "kitchenBath",
    projectType: "renovation",
    nameKey: "kitchenBath",
    descKey: "kitchenBathDesc",
    materials: [
      { nameKey: "designFee", category: "labor", phase: "demolition", quantity: 1, price: 3500, supplyType: "laborOnly" },
      { nameKey: "kitchenDemolition", category: "labor", phase: "demolition", quantity: 1, price: 1800, room: "kitchen", supplyType: "laborOnly" },
      { nameKey: "bathDemolition", category: "labor", phase: "demolition", quantity: 1, price: 1500, room: "bathroom", supplyType: "laborOnly" },
      { nameKey: "kitchenPlumbing", category: "structure", phase: "plumbingElectrical", quantity: 1, price: 4500, room: "kitchen", supplyType: "turnkey" },
      { nameKey: "bathPlumbing", category: "structure", phase: "plumbingElectrical", quantity: 1, price: 4000, room: "bathroom", supplyType: "turnkey" },
      { nameKey: "bathWaterproof", category: "structure", phase: "plumbingElectrical", quantity: 1, price: 3200, room: "bathroom", supplyType: "turnkey" },
      { nameKey: "floorTiles", category: "finishes", phase: "carpentryMasonry", quantity: 35, price: 120, room: "whole", supplyType: "selfPurchase" },
      { nameKey: "kitchenAppliances", category: "appliances", phase: "installation", quantity: 1, price: 22000, room: "kitchen", supplyType: "selfPurchase" },
      { nameKey: "bathroomFixtures", category: "appliances", phase: "installation", quantity: 1, price: 8800, room: "bathroom", supplyType: "selfPurchase" },
      { nameKey: "localPaint", category: "finishes", phase: "painting", quantity: 1, price: 2800, supplyType: "laborOnly" },
      { nameKey: "wasteRemoval", category: "misc", phase: "demolition", quantity: 1, price: 800, supplyType: "laborOnly" },
      { nameKey: "miscSupplies", category: "misc", phase: "installation", quantity: 1, price: 600, room: "whole", supplyType: "selfPurchase" },
    ],
  },
  {
    id: "ruralSelfBuild",
    projectType: "construction",
    nameKey: "ruralSelfBuild",
    descKey: "ruralSelfBuildDesc",
    materials: [
      { nameKey: "designFee", category: "labor", phase: "foundation", quantity: 1, price: 8000, supplyType: "laborOnly" },
      { nameKey: "foundationConcrete", category: "structure", phase: "foundation", quantity: 1, price: 28000, supplyType: "turnkey" },
      { nameKey: "brickMasonry", category: "structure", phase: "structure", quantity: 1, price: 45000, supplyType: "turnkey" },
      { nameKey: "roofTiles", category: "structure", phase: "roofing", quantity: 1, price: 18000, supplyType: "turnkey" },
      { nameKey: "doorsWindows", category: "finishes", phase: "exterior", quantity: 1, price: 18300, room: "exterior", supplyType: "selfPurchase" },
      { nameKey: "roughPlumbing", category: "structure", phase: "interiorRough", quantity: 1, price: 15000, supplyType: "turnkey" },
      { nameKey: "interiorFinish", category: "finishes", phase: "interiorFinish", quantity: 1, price: 22000, supplyType: "turnkey" },
      { nameKey: "solarWaterHeater", category: "appliances", phase: "installation", quantity: 1, price: 4500, supplyType: "selfPurchase" },
      { nameKey: "yardPaving", category: "misc", phase: "landscaping", quantity: 1, price: 6800, supplyType: "turnkey" },
      { nameKey: "miscSupplies", category: "misc", phase: "interiorFinish", quantity: 1, price: 2500, room: "whole", supplyType: "selfPurchase" },
    ],
  },
  {
    id: "custom",
    projectType: "renovation",
    nameKey: "custom",
    descKey: "customDesc",
    materials: [],
  },
];

export function getProjectTemplate(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((t) => t.id === id);
}

export function templatesForType(type: ProjectType): ProjectTemplate[] {
  return PROJECT_TEMPLATES.filter((t) => t.id === "custom" || t.projectType === type);
}
