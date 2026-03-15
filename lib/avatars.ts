export const AVATAR_PRESETS = [
  { id: "red", color: "#e50914" },
  { id: "blue", color: "#0071eb" },
  { id: "green", color: "#2dba4e" },
  { id: "gold", color: "#f5c518" },
  { id: "purple", color: "#a855f7" },
  { id: "orange", color: "#f97316" },
  { id: "pink", color: "#ec4899" },
  { id: "teal", color: "#14b8a6" },
  { id: "indigo", color: "#6366f1" },
  { id: "rose", color: "#fb7185" },
  { id: "cyan", color: "#22d3ee" },
  { id: "lime", color: "#84cc16" },
] as const;

export type AvatarId = (typeof AVATAR_PRESETS)[number]["id"];

export function getAvatar(id: string) {
  return AVATAR_PRESETS.find((a) => a.id === id) ?? AVATAR_PRESETS[0];
}
