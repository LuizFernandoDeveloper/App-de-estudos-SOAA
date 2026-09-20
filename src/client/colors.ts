export const COLOR_HEX: Record<string, string> = {
  indigo: "#818cf8",
  violet: "#a78bfa",
  cyan: "#22d3ee",
  pink: "#f472b6",
  amber: "#fbbf24",
  emerald: "#34d399",
  orange: "#fb923c",
  blue: "#60a5fa"
};

export const COLOR_OPTIONS = Object.keys(COLOR_HEX);

export function color(name: string): string {
  return COLOR_HEX[name] ?? COLOR_HEX.blue;
}