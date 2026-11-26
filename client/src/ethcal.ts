// Gregorian -> Ethiopian calendar conversion (Amete Mihret era).
const MONTHS_EN = ["Meskerem", "Tikimt", "Hidar", "Tahsas", "Tir", "Yekatit", "Megabit", "Miazia", "Ginbot", "Sene", "Hamle", "Nehase", "Pagume"];
const MONTHS_AM = ["መስከረም", "ጥቅምት", "ኅዳር", "ታኅሣሥ", "ጥር", "የካቲት", "መጋቢት", "ሚያዝያ", "ግንቦት", "ሰኔ", "ሐምሌ", "ነሐሴ", "ጳጉሜ"];

function gregorianToJdn(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
}

export function toEthiopian(iso: string): { y: number; m: number; d: number } | null {
  const mt = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!mt) return null;
  const jdn = gregorianToJdn(+mt[1], +mt[2], +mt[3]);
  const r = (jdn - 1723856) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  return {
    y: 4 * Math.floor((jdn - 1723856) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460),
    m: Math.floor(n / 30) + 1,
    d: (n % 30) + 1,
  };
}

export function formatDate(iso: string | null | undefined, lang: "en" | "am"): string {
  if (!iso) return "—";
  const e = toEthiopian(iso);
  if (!e) return iso;
  return `${(lang === "am" ? MONTHS_AM : MONTHS_EN)[e.m - 1]} ${e.d}, ${e.y}`;
}

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
