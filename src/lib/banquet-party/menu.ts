import type { Material, MaterialCategory, MenuCourse } from "@/lib/banquet-party/types";

/** 菜单展示顺序 */
export const MENU_COURSE_ORDER: MenuCourse[] = ["appetizer", "snack", "main", "kids", "dessert", "drink"];

/** 食材可选分组（酒水固定为 drink） */
export const FOOD_MENU_COURSES: MenuCourse[] = ["appetizer", "snack", "main", "kids", "dessert"];

export function resolveMenuCourse(material: Material): MenuCourse | null {
  if (material.category !== "food" && material.category !== "drink") return null;
  if (material.menuCourse) return material.menuCourse;
  if (material.category === "drink") return "drink";
  return "main";
}

export function groupMenuMaterials(materials: Material[]): { course: MenuCourse; items: Material[] }[] {
  const buckets = new Map<MenuCourse, Material[]>();
  for (const course of MENU_COURSE_ORDER) {
    buckets.set(course, []);
  }
  for (const m of materials) {
    const course = resolveMenuCourse(m);
    if (!course) continue;
    buckets.get(course)!.push(m);
  }
  return MENU_COURSE_ORDER.map((course) => ({ course, items: buckets.get(course)! })).filter((g) => g.items.length > 0);
}

export function defaultMenuCourseForCategory(category: MaterialCategory): MenuCourse | undefined {
  if (category === "drink") return "drink";
  if (category === "food") return "main";
  return undefined;
}

export function menuCourseForSave(category: MaterialCategory, menuCourse: MenuCourse | ""): MenuCourse | undefined {
  if (category === "drink") return "drink";
  if (category === "food" && menuCourse && menuCourse !== "drink") return menuCourse;
  if (category === "food") return "main";
  return undefined;
}

export function inferMenuCourse(category: MaterialCategory, initial?: Material): MenuCourse {
  if (initial?.menuCourse) return initial.menuCourse;
  return defaultMenuCourseForCategory(category) ?? "main";
}
