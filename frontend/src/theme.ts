/**
 * Theme tokens for Řemeslník Pro 1.0
 * Based on /app/design_guidelines.json (Organic & Earthy archetype)
 */
export const theme = {
  colors: {
    bg: "#f4f1eb",
    surface: "#ffffff",
    surfaceMuted: "#fbfbf9",
    primary: "#c9820a",
    primaryHover: "#b37309",
    primaryLight: "#fcede3",
    text: "#2d2926",
    textMuted: "#68635c",
    textInverse: "#ffffff",
    border: "#e2ded7",
    borderFocus: "#c9820a",
    placeholder: "#8c857b",
    status: {
      rozpracovano: { bg: "#e5e3df", text: "#5c5853" },
      schvaleno: { bg: "#e3f0e8", text: "#315942" },
      odlozeno: { bg: "#fcede3", text: "#945f06" },
      dokonceno: { bg: "#e0edf2", text: "#244d5a" },
      expirovano: { bg: "#f5e1e1", text: "#822c22" },
    },
    danger: "#822c22",
  },
  radius: { card: 20, button: 14, input: 14, tag: 999 },
  spacing: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 },
  shadow: {
    card: {
      shadowColor: "#2d2926",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 2,
    },
    floating: {
      shadowColor: "#c9820a",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 6,
    },
  },
  typography: {
    h1: { fontSize: 28, fontWeight: "800" as const, color: "#2d2926" },
    h2: { fontSize: 22, fontWeight: "700" as const, color: "#2d2926" },
    h3: { fontSize: 17, fontWeight: "700" as const, color: "#2d2926" },
    body: { fontSize: 15, color: "#2d2926" },
    bodyMuted: { fontSize: 14, color: "#68635c" },
    small: { fontSize: 12, color: "#68635c" },
    overline: {
      fontSize: 11,
      fontWeight: "700" as const,
      color: "#68635c",
      letterSpacing: 1.4,
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
