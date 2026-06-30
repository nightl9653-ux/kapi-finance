import type { MenuCourse } from "@/lib/banquet-party/types";

type BanquetT = (key: string) => string;

/** 静态 key，避免 `menuCourse.${course}` 动态 key 在 dev 下偶发缺失 */
export function menuCourseLabel(t: BanquetT, course: MenuCourse): string {
  switch (course) {
    case "appetizer":
      return t("menuCourse.appetizer");
    case "snack":
      return t("menuCourse.snack");
    case "main":
      return t("menuCourse.main");
    case "kids":
      return t("menuCourse.kids");
    case "dessert":
      return t("menuCourse.dessert");
    case "drink":
      return t("menuCourse.drink");
  }
}
