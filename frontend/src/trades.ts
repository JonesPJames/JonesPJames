/** Trade calculator presets (CZ market). Prices are starting orientational values. */
export type PresetItem = { popis: string; jednotka: string; cena: number };
export type Trade = { key: string; name: string; icon: string; items: PresetItem[] };

export const TRADES: Trade[] = [
  {
    key: "zednik",
    name: "Zedník",
    icon: "construct",
    items: [
      { popis: "Zdění příčky (tl. 100 mm)", jednotka: "m2", cena: 650 },
      { popis: "Omítka strojní vápenocementová", jednotka: "m2", cena: 320 },
      { popis: "Omítka ruční štuková", jednotka: "m2", cena: 380 },
      { popis: "Reprofilace zdiva", jednotka: "m2", cena: 450 },
      { popis: "Betonáž podlahy (tl. 80 mm)", jednotka: "m2", cena: 590 },
      { popis: "Bourací práce zdiva", jednotka: "m3", cena: 1900 },
    ],
  },
  {
    key: "obkladac",
    name: "Obkladač",
    icon: "grid",
    items: [
      { popis: "Obklad stěn keramický", jednotka: "m2", cena: 750 },
      { popis: "Pokládka dlažby", jednotka: "m2", cena: 720 },
      { popis: "Hydroizolační stěrka", jednotka: "m2", cena: 280 },
      { popis: "Spárování silikonem", jednotka: "bm", cena: 110 },
      { popis: "Demontáž starých obkladů", jednotka: "m2", cena: 220 },
    ],
  },
  {
    key: "malir",
    name: "Malíř",
    icon: "color-palette",
    items: [
      { popis: "Malba 2× disperzní bílá", jednotka: "m2", cena: 90 },
      { popis: "Penetrace", jednotka: "m2", cena: 35 },
      { popis: "Tmelení a broušení", jednotka: "m2", cena: 120 },
      { popis: "Tapetování", jednotka: "m2", cena: 280 },
      { popis: "Nátěr fasády", jednotka: "m2", cena: 250 },
    ],
  },
  {
    key: "elektrikar",
    name: "Elektrikář",
    icon: "flash",
    items: [
      { popis: "Rozvod kabeláže (CYKY)", jednotka: "bm", cena: 95 },
      { popis: "Montáž zásuvky", jednotka: "ks", cena: 280 },
      { popis: "Montáž vypínače", jednotka: "ks", cena: 250 },
      { popis: "Montáž svítidla", jednotka: "ks", cena: 380 },
      { popis: "Montáž rozvaděče", jednotka: "ks", cena: 4500 },
      { popis: "Revize elektroinstalace", jednotka: "ks", cena: 2500 },
    ],
  },
  {
    key: "instalater",
    name: "Instalatér",
    icon: "water",
    items: [
      { popis: "Rozvod vody (PPR)", jednotka: "bm", cena: 320 },
      { popis: "Rozvod kanalizace (HT)", jednotka: "bm", cena: 380 },
      { popis: "Montáž baterie", jednotka: "ks", cena: 850 },
      { popis: "Montáž WC", jednotka: "ks", cena: 1900 },
      { popis: "Montáž sprchového koutu", jednotka: "ks", cena: 4500 },
      { popis: "Montáž radiátoru", jednotka: "ks", cena: 1800 },
    ],
  },
  {
    key: "tesar",
    name: "Tesař",
    icon: "hammer",
    items: [
      { popis: "Montáž střešní konstrukce", jednotka: "m2", cena: 850 },
      { popis: "Montáž oken", jednotka: "ks", cena: 1900 },
      { popis: "Montáž dveří", jednotka: "ks", cena: 1500 },
      { popis: "Obložkové zárubně", jednotka: "ks", cena: 2200 },
      { popis: "Montáž schodiště", jednotka: "ks", cena: 18000 },
    ],
  },
  {
    key: "podlahar",
    name: "Podlahář",
    icon: "albums",
    items: [
      { popis: "Pokládka vinylové podlahy", jednotka: "m2", cena: 320 },
      { popis: "Pokládka laminátové podlahy", jednotka: "m2", cena: 280 },
      { popis: "Pokládka koberce", jednotka: "m2", cena: 250 },
      { popis: "Broušení parketu", jednotka: "m2", cena: 380 },
      { popis: "Lišty a ukončení", jednotka: "bm", cena: 140 },
    ],
  },
  {
    key: "sadrokartonar",
    name: "Sádrokartonář",
    icon: "layers",
    items: [
      { popis: "SDK předstěna", jednotka: "m2", cena: 720 },
      { popis: "SDK příčka", jednotka: "m2", cena: 850 },
      { popis: "SDK podhled", jednotka: "m2", cena: 780 },
      { popis: "Opláštění sloupů", jednotka: "bm", cena: 950 },
      { popis: "Šachtování", jednotka: "bm", cena: 850 },
    ],
  },
  {
    key: "klempir",
    name: "Klempíř",
    icon: "umbrella",
    items: [
      { popis: "Oplechování střechy", jednotka: "m2", cena: 950 },
      { popis: "Montáž okapů", jednotka: "bm", cena: 580 },
      { popis: "Parapety", jednotka: "ks", cena: 1200 },
      { popis: "Montáž střešních oken", jednotka: "ks", cena: 4800 },
    ],
  },
  {
    key: "dlazdic",
    name: "Dlaždič / Pokládač",
    icon: "apps",
    items: [
      { popis: "Pokládka venkovní dlažby", jednotka: "m2", cena: 850 },
      { popis: "Obrubníky", jednotka: "bm", cena: 380 },
      { popis: "Zámková dlažba", jednotka: "m2", cena: 750 },
      { popis: "Štěrkový podsyp", jednotka: "m2", cena: 220 },
    ],
  },
  {
    key: "zamecnik",
    name: "Zámečník",
    icon: "shield-checkmark",
    items: [
      { popis: "Montáž zábradlí", jednotka: "bm", cena: 1900 },
      { popis: "Montáž brány", jednotka: "ks", cena: 8500 },
      { popis: "Montáž garážových vrat", jednotka: "ks", cena: 12000 },
      { popis: "Montáž ocelové konstrukce", jednotka: "kg", cena: 95 },
    ],
  },
];
