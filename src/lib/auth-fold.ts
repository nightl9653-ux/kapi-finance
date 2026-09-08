/** Fold fullwidth digits/letters from Chinese IMEs into ASCII. */
export function foldPassword(password: string) {
  return password.normalize("NFKC");
}
