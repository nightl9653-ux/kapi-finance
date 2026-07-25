import type { MiscType } from "@/lib/banquet-party/types";
import { MISC_TYPE_EMOJI } from "@/lib/banquet-party/misc";

type BanquetT = (key: string) => string;

export function miscTypeLabel(t: BanquetT, miscType: MiscType): string {
  switch (miscType) {
    case "favor":
      return t("miscType.favor");
    case "service":
      return t("miscType.service");
    case "venue":
      return t("miscType.venue");
    case "media":
      return t("miscType.media");
    case "print":
      return t("miscType.print");
    case "entertainment":
      return t("miscType.entertainment");
    case "logistics":
      return t("miscType.logistics");
    case "deposit":
      return t("miscType.deposit");
    case "other":
      return t("miscType.other");
  }
}

export function miscTypeDisplay(t: BanquetT, miscType: MiscType): string {
  return `${MISC_TYPE_EMOJI[miscType]} ${miscTypeLabel(t, miscType)}`;
}
