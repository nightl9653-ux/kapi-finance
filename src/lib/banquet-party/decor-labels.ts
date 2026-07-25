import type { DecorAtmosphereTag, DecorZone } from "@/lib/banquet-party/types";
import {
  decorWearableHintGroupItemsText,
  decorWearableHintGroupLabelText,
  decorZoneHintText,
} from "@/lib/banquet-party/decor-hints";
import { DECOR_WEARABLE_HINT_GROUPS, DECOR_ZONE_EMOJI, type DecorWearableHintGroup } from "@/lib/banquet-party/decor";

type BanquetT = (key: string) => string;

export function decorZoneLabel(t: BanquetT, zone: DecorZone): string {
  switch (zone) {
    case "entrance":
      return t("decorZone.entrance");
    case "table":
      return t("decorZone.table");
    case "photo":
      return t("decorZone.photo");
    case "avLighting":
      return t("decorZone.avLighting");
    case "overhead":
      return t("decorZone.overhead");
    case "floor":
      return t("decorZone.floor");
    case "scentAir":
      return t("decorZone.scentAir");
    case "wearable":
      return t("decorZone.wearable");
  }
}

export function decorZoneHint(locale: string, zone: DecorZone): string {
  if (zone === "wearable") return "";
  return decorZoneHintText(locale, zone);
}

export function decorWearableHintGroupLabel(locale: string, group: DecorWearableHintGroup): string {
  return decorWearableHintGroupLabelText(locale, group);
}

export function decorWearableHintGroupItems(locale: string, group: DecorWearableHintGroup): string {
  return decorWearableHintGroupItemsText(locale, group);
}

export { DECOR_WEARABLE_HINT_GROUPS };

export function decorZoneDisplay(t: BanquetT, zone: DecorZone): string {
  return `${DECOR_ZONE_EMOJI[zone]} ${decorZoneLabel(t, zone)}`;
}

export function decorAtmosphereLabel(t: BanquetT, tag: DecorAtmosphereTag): string {
  switch (tag) {
    case "silk":
      return t("decorAtmosphere.silk");
    case "metal":
      return t("decorAtmosphere.metal");
    case "wood":
      return t("decorAtmosphere.wood");
    case "glass":
      return t("decorAtmosphere.glass");
    case "plush":
      return t("decorAtmosphere.plush");
    case "paper":
      return t("decorAtmosphere.paper");
    case "plastic":
      return t("decorAtmosphere.plastic");
    case "natural":
      return t("decorAtmosphere.natural");
    case "pearl":
      return t("decorAtmosphere.pearl");
    case "diamond":
      return t("decorAtmosphere.diamond");
    case "agateMoonstone":
      return t("decorAtmosphere.agateMoonstone");
    case "platinumSilver":
      return t("decorAtmosphere.platinumSilver");
    case "amberTurquoise":
      return t("decorAtmosphere.amberTurquoise");
    case "goldWhiteGold":
      return t("decorAtmosphere.goldWhiteGold");
    case "gemInlay":
      return t("decorAtmosphere.gemInlay");
    case "leatherCoral":
      return t("decorAtmosphere.leatherCoral");
    case "opalTourmalineSpinel":
      return t("decorAtmosphere.opalTourmalineSpinel");
  }
}
