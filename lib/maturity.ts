export type MaturityLevel = "KIDS" | "TEEN" | "ADULT";

// Map every known rating to the minimum level required to view it.
// Unrecognized ratings default to ADULT (conservative).
// null/undefined ratings are permissive (no data → don't hide).
const RATING_TO_LEVEL: Record<string, MaturityLevel> = {
  // US movies
  G: "KIDS",
  PG: "TEEN",
  "PG-13": "TEEN",
  R: "ADULT",
  "NC-17": "ADULT",

  // US TV
  "TV-Y": "KIDS",
  "TV-Y7": "KIDS",
  "TV-G": "KIDS",
  "TV-PG": "TEEN",
  "TV-14": "TEEN",
  "TV-MA": "ADULT",

  // UK
  U: "KIDS",
  "12": "TEEN",
  "12A": "TEEN",
  "15": "ADULT",
  "15+": "ADULT",
  "18": "ADULT",
  "18+": "ADULT",

  // Australia
  // G → already mapped above
  M: "TEEN",
  "MA15+": "ADULT",
  "R18+": "ADULT",
  "X18+": "ADULT",

  // European numeric
  "0": "KIDS",
  "6": "KIDS",
  "7": "KIDS",
  "10": "TEEN",
  "12+": "TEEN",
  "13": "TEEN",
  "13+": "TEEN",
  "14": "TEEN",
  "16": "ADULT",
  "16+": "ADULT",
};

const LEVEL_ORDER: Record<MaturityLevel, number> = { KIDS: 0, TEEN: 1, ADULT: 2 };

/** Returns the maturity level required to view a rating, or ADULT for unknowns. */
export function getRatingLevel(rating: string): MaturityLevel {
  return RATING_TO_LEVEL[rating.toUpperCase()] ?? RATING_TO_LEVEL[rating] ?? "ADULT";
}

export function passesMaturityFilter(
  rating: string | null | undefined,
  level: MaturityLevel
): boolean {
  if (level === "ADULT") return true;
  if (!rating) return true; // no rating data → permissive
  const required = getRatingLevel(rating);
  return LEVEL_ORDER[required] <= LEVEL_ORDER[level];
}
