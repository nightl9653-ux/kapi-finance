/**
 * 从系统剪贴板读取第一张图片（Clipboard API）。
 * iOS Safari 常需在用户手势后调用；自动打开页面时可能失败，需配合「点按读取」兜底。
 */
export async function readImageFileFromClipboard(): Promise<File | null> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.read) {
    return null;
  }
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageTypes = item.types.filter((ty) => ty.startsWith("image/"));
      for (const type of imageTypes) {
        const blob = await item.getType(type);
        if (!blob || blob.size === 0) continue;
        const ext = type.split("/")[1]?.split("+")[0] ?? "png";
        return new File([blob], `clipboard.${ext}`, { type });
      }
    }
  } catch {
    return null;
  }
  return null;
}
