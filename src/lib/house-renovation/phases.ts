import type { ConstructionPhase, ProjectPhase, ProjectType, RenovationPhase } from "@/lib/house-renovation/types";

export const RENOVATION_PHASE_ORDER: RenovationPhase[] = [
  "demolition",
  "plumbingElectrical",
  "carpentryMasonry",
  "painting",
  "installation",
  "furnishing",
  "inspection",
];

export const CONSTRUCTION_PHASE_ORDER: ConstructionPhase[] = [
  "foundation",
  "structure",
  "roofing",
  "exterior",
  "interiorRough",
  "interiorFinish",
  "landscaping",
  "inspection",
];

export function phasesForProjectType(type: ProjectType): ProjectPhase[] {
  return type === "construction" ? CONSTRUCTION_PHASE_ORDER : RENOVATION_PHASE_ORDER;
}

export function defaultPhaseForType(type: ProjectType): ProjectPhase {
  return phasesForProjectType(type)[0]!;
}

export function isKnownPhase(phase: string, type: ProjectType): phase is ProjectPhase {
  return phasesForProjectType(type).includes(phase as ProjectPhase);
}
