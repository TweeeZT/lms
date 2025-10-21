// Shared helpers to map internal codes to Indonesian display labels/colors

export function getCategoryLabel(category?: string | null): string {
  if (!category) return "-";
  const map: Record<string, string> = {
    scratch: "Scratch",
    roblox: "Roblox",
    robotics: "Robotik",
  };
  return map[category] || capitalize(category);
}

export function getCategoryColor(category?: string | null): string {
  if (!category) return "gray";
  const map: Record<string, string> = {
    scratch: "orange",
    roblox: "cyan",
    robotics: "teal",
  };
  return map[category] || "gray";
}

export function getLevelLabel(level?: string | null): string {
  if (!level) return "-";
  const map: Record<string, string> = {
    beginner: "Pemula",
    intermediate: "Menengah",
    advanced: "Lanjutan",
  };
  return map[level] || capitalize(level);
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
