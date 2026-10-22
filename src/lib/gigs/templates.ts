import type { GigInstallment, GigVertical } from "@/lib/gigs/types";
import { newGigId } from "@/lib/gigs/types";

export type GigOpeningPackage = {
  id: string;
  vertical: GigVertical;
  /** 与合同总额相乘；最后一期吃掉余数，保证加总等于总额 */
  ratios: number[];
  /** 无翻译时写入项目的分期名 */
  labels: string[];
};

export const GIG_PACKAGES: GigOpeningPackage[] = [
  { id: "designBrand", vertical: "design", ratios: [0.3, 0.4, 0.3], labels: ["定金 30%", "中期款", "尾款"] },
  { id: "designPoster", vertical: "design", ratios: [1], labels: ["全款"] },
  { id: "designSite", vertical: "design", ratios: [0.3, 0.2, 0.2, 0.3], labels: ["定金", "首页", "内页", "尾款"] },
  {
    id: "devSite",
    vertical: "development",
    ratios: [0.25, 0.25, 0.25, 0.25],
    labels: ["启动款", "里程碑 1", "里程碑 2", "验收尾款"],
  },
  { id: "devFeature", vertical: "development", ratios: [0.5, 0.5], labels: ["启动款", "验收尾款"] },
  {
    id: "trainPack",
    vertical: "training",
    ratios: [1],
    labels: ["课时包全款"],
  },
  {
    id: "train12",
    vertical: "training",
    ratios: [0.25, 0.25, 0.25, 0.25],
    labels: ["第 1–3 节", "第 4–6 节", "第 7–9 节", "第 10–12 节"],
  },
  { id: "consultTwo", vertical: "consulting", ratios: [0.5, 0.5], labels: ["首期", "尾款"] },
  { id: "consultOnce", vertical: "consulting", ratios: [1], labels: ["全款"] },
  { id: "otherFull", vertical: "other", ratios: [1], labels: ["全款"] },
  { id: "otherTwo", vertical: "other", ratios: [0.5, 0.5], labels: ["首期", "尾款"] },
];

export function packagesForVertical(vertical: GigVertical): GigOpeningPackage[] {
  return GIG_PACKAGES.filter((pkg) => pkg.vertical === vertical);
}

export function defaultPackageForVertical(vertical: GigVertical): GigOpeningPackage {
  const found = packagesForVertical(vertical)[0];
  if (!found) throw new Error(`no opening package for ${vertical}`);
  return found;
}

export function packageById(id: string): GigOpeningPackage | undefined {
  return GIG_PACKAGES.find((pkg) => pkg.id === id);
}

export function makeInstallmentsFromPackage(
  pkg: GigOpeningPackage,
  totalAmount: number,
  labels?: string[],
): GigInstallment[] {
  const names = labels && labels.length === pkg.labels.length ? labels : pkg.labels;
  const amounts = splitByRatios(totalAmount, pkg.ratios);
  return names.map((label, i) => ({
    id: newGigId(),
    label,
    amount: amounts[i] ?? 0,
    status: "pending" as const,
    paidAmount: 0,
  }));
}

/** 业态默认开单包的分期（金额另算） */
export function defaultInstallmentsForVertical(vertical: GigVertical): Omit<GigInstallment, "amount">[] {
  return makeInstallmentsFromPackage(defaultPackageForVertical(vertical), 0).map((inst) => ({
    id: inst.id,
    label: inst.label,
    status: inst.status,
    paidAmount: inst.paidAmount,
  }));
}

export function makeInstallmentsFromTemplate(vertical: GigVertical, totalAmount: number): GigInstallment[] {
  return makeInstallmentsFromPackage(defaultPackageForVertical(vertical), totalAmount);
}

function splitByRatios(totalAmount: number, ratios: number[]): number[] {
  const total = Math.max(0, Number(totalAmount) || 0);
  if (ratios.length === 0) return [];
  if (ratios.length === 1) return [round2(total)];
  const amounts: number[] = [];
  let used = 0;
  for (let i = 0; i < ratios.length - 1; i++) {
    const part = round2(total * (ratios[i] ?? 0));
    amounts.push(part);
    used = round2(used + part);
  }
  amounts.push(round2(total - used));
  return amounts;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
