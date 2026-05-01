/**
 * Řemeslník Pro 1.0 — REDESIGNED theme
 * Minimalist, industrial, monochrome with dark charcoal as primary.
 * Maximum contrast for outdoor legibility on a construction site.
 */
export const theme = {
  colors: {
    // Backgrounds — clean white/near-white, no warm tint
    bg: "#fafafa",
    surface: "#ffffff",
    surfaceMuted: "#f5f5f5",

    // Primary — industrial charcoal (replaces orange)
    primary: "#1f1f1f",
    primaryHover: "#000000",
    primaryLight: "#f0f0f0",

    // Typography — near-black for max contrast
    text: "#0a0a0a",
    textMuted: "#6b6b6b",
    textInverse: "#ffffff",

    // Structural lines
    border: "#e5e5e5",
    borderFocus: "#1f1f1f",
    placeholder: "#9ca3af",

    // Status — muted pastel backgrounds + strong dark text for max legibility
    status: {
      rozpracovano: { bg: "#ededed", text: "#3f3f3f" },
      schvaleno: { bg: "#dcfce7", text: "#14532d" },
      odlozeno: { bg: "#fef3c7", text: "#78350f" },
      dokonceno: { bg: "#dbeafe", text: "#1e3a8a" },
      expirovano: { bg: "#fee2e2", text: "#7f1d1d" },
    },

    danger: "#991b1b",
    success: "#14532d",
  },
  radius: { card: 16, button: 12, input: 12, tag: 999 },
  spacing: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 },
  shadow: {
    card: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    floating: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 4,
    },
  },
  typography: {
    h1: { fontSize: 30, fontWeight: "800" as const, color: "#0a0a0a" },
    h2: { fontSize: 24, fontWeight: "800" as const, color: "#0a0a0a" },
    h3: { fontSize: 19, fontWeight: "700" as const, color: "#0a0a0a" },
    body: { fontSize: 16, color: "#0a0a0a" },
    bodyMuted: { fontSize: 15, color: "#6b6b6b" },
    small: { fontSize: 13, color: "#6b6b6b" },
    overline: {
      fontSize: 11,
      fontWeight: "800" as const,
      color: "#6b6b6b",
      letterSpacing: 1.6,
      textTransform: "uppercase" as const,
    },
  },
};

export const STATUS_LABELS: Record<string, string> = {
  rozpracovano: "Rozpracováno",
  schvaleno: "Schváleno • Probíhá",
  odlozeno: "Odloženo",
  dokonceno: "Dokončeno",
  expirovano: "Expirováno",
};

export function fmtCZK(n: number | undefined | null): string {
  const v = Math.round(Number(n || 0));
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " Kč";
}

export function fmtDateCZ(iso: string | Date): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return "";
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}
