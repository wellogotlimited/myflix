export type MaturityLevel = "KIDS" | "TEEN" | "ADULT";

const ALLOWED: Record<MaturityLevel, string[]> = {
  KIDS: ["G", "TV-Y", "TV-Y7", "TV-G"],
  TEEN: ["G", "PG", "PG-13", "TV-Y", "TV-Y7", "TV-G", "TV-PG", "TV-14"],
  ADULT: [],
};

export function passesMaturityFilter(
  rating: string | null | undefined,
  level: MaturityLevel
): boolean {
  if (level === "ADULT") return true;
  if (!rating) return true;
  return ALLOWED[level].includes(rating.toUpperCase());
}
