/** Trade calculator presets (CZ market) + tool checklists per trade. */
export type PresetItem = { popis: string; jednotka: string; cena: number };
export type Trade = { key: string; name: string; icon: string; items: PresetItem[]; tools: string[] };

const TOOLS: Record<string, string[]> = {
  zednik: ["Zednická lžíce", "Zednické kladívko", "Hladítko", "Stahovací lať", "Vodováha 2 m", "Olovnice", "Míchadlo + vrtačka", "Kbelíky a vědra", "Sekáč a kladivo", "Pracovní žebřík"],
  obkladac: ["Zubatá stěrka", "Gumové paličky", "Řezačka obkladů (mokrá pila)", "Kotoučová pila s diamantovým kotoučem", "Vodováha", "Křížky a klíny", "Spárovací stěrka", "Houba a kbelík", "Maskovací páska", "Silikonová pistole"],
  malir: ["Válečky (různé velikosti)", "Štětce ploché a kulaté", "Vana na barvu + mřížka", "Maskovací páska", "Plachty / krycí folie", "Špachtle", "Brusné papíry", "Penetrační váleček", "Teleskopická tyč", "Hadr a kbelík"],
  elektrikar: ["Sada šroubováků izolovaných", "Kombinované kleště", "Štípací kleště", "Odizolovací kleště", "Multimetr", "Hledačka napětí", "Aku vrtačka + bity", "Příklepová vrtačka", "Měřič izolace", "Gumové rukavice"],
  instalater: ["Hasák / trubkové kleště", "Sada plochých klíčů", "Závitnice", "Pájka + plynový hořák", "Svářečka PPR + hlavy", "Řezák trubek", "Vodováha", "Detektor netěsnosti", "Teflonová páska / konopí", "Aku vrtačka"],
  tesar: ["Okružní pila", "Ruční pila", "Aku šroubovák", "Rázový utahovák", "Tesařské kladivo", "Sekera", "Hoblík", "Vodováha 2 m", "Tesařský úhelník", "Pásmo / metr", "Nivelační laser"],
  podlahar: ["Řezací nůž (lamino/vinyl)", "Pily — pokosová a přímočará", "Distanční klíny", "Gumová palička", "Tažný hák", "Stahovací lať", "Vodováha", "Vysavač", "Brusivo", "Lepidlo a stěrka"],
  sadrokartonar: ["Aku šroubovák s magnetickým bitem", "Nůž na SDK", "Tahový pás", "Hoblík na SDK", "Profilové nůžky", "Hladítka tmelová", "Brusná mřížka + držák", "Vodováha 2 m", "Laser / nivelák"],
  klempir: ["Klempířské nůžky", "Klempířské kladivo", "Ohýbačka plechu", "Falcovačka", "Nýtovačka", "Aku vrtačka", "Pájka (cín)", "Pásmo", "Žebřík střešní", "Bezpečnostní postroj"],
  dlazdic: ["Lopata", "Hrábě", "Vibrační deska", "Gumová palička", "Vodováha 2 m", "Měřící lať", "Křížky pro dlažbu", "Mokrá pila na dlažbu", "Štípačky na dlažbu", "Kbelíky"],
  zamecnik: ["Aku vrtačka", "Bruska úhlová 125/230", "Svářečka", "Pilník sady", "Ráčna a klíče", "Rázový utahovák", "Vodováha", "Pásmo 5 m", "Kotouče řezné a brusné", "Svářečská kukla a rukavice"],
};

export const TRADES: Trade[] = [
  { key: "zednik", name: "Zedník", icon: "construct", tools: TOOLS.zednik, items: [
      { popis: "Zdění příčky (tl. 100 mm)", jednotka: "m2", cena: 650 },
      { popis: "Omítka strojní vápenocementová", jednotka: "m2", cena: 320 },
      { popis: "Omítka ruční štuková", jednotka: "m2", cena: 380 },
      { popis: "Reprofilace zdiva", jednotka: "m2", cena: 450 },
      { popis: "Betonáž podlahy (tl. 80 mm)", jednotka: "m2", cena: 590 },
      { popis: "Bourací práce zdiva", jednotka: "m3", cena: 1900 },
  ]},
  { key: "obkladac", name: "Obkladač", icon: "grid", tools: TOOLS.obkladac, items: [
      { popis: "Obklad stěn keramický", jednotka: "m2", cena: 750 },
      { popis: "Pokládka dlažby", jednotka: "m2", cena: 720 },
      { popis: "Hydroizolační stěrka", jednotka: "m2", cena: 280 },
      { popis: "Spárování silikonem", jednotka: "bm", cena: 110 },
      { popis: "Demontáž starých obkladů", jednotka: "m2", cena: 220 },
  ]},
  { key: "malir", name: "Malíř", icon: "color-palette", tools: TOOLS.malir, items: [
      { popis: "Malba 2× disperzní bílá", jednotka: "m2", cena: 90 },
      { popis: "Penetrace", jednotka: "m2", cena: 35 },
      { popis: "Tmelení a broušení", jednotka: "m2", cena: 120 },
      { popis: "Tapetování", jednotka: "m2", cena: 280 },
      { popis: "Nátěr fasády", jednotka: "m2", cena: 250 },
  ]},
  { key: "elektrikar", name: "Elektrikář", icon: "flash", tools: TOOLS.elektrikar, items: [
      { popis: "Rozvod kabeláže (CYKY)", jednotka: "bm", cena: 95 },
      { popis: "Montáž zásuvky", jednotka: "ks", cena: 280 },
      { popis: "Montáž vypínače", jednotka: "ks", cena: 250 },
      { popis: "Montáž svítidla", jednotka: "ks", cena: 380 },
      { popis: "Montáž rozvaděče", jednotka: "ks", cena: 4500 },
      { popis: "Revize elektroinstalace", jednotka: "ks", cena: 2500 },
  ]},
  { key: "instalater", name: "Instalatér", icon: "water", tools: TOOLS.instalater, items: [
      { popis: "Rozvod vody (PPR)", jednotka: "bm", cena: 320 },
      { popis: "Rozvod kanalizace (HT)", jednotka: "bm", cena: 380 },
      { popis: "Montáž baterie", jednotka: "ks", cena: 850 },
      { popis: "Montáž WC", jednotka: "ks", cena: 1900 },
      { popis: "Montáž sprchového koutu", jednotka: "ks", cena: 4500 },
      { popis: "Montáž radiátoru", jednotka: "ks", cena: 1800 },
  ]},
  { key: "tesar", name: "Tesař", icon: "hammer", tools: TOOLS.tesar, items: [
      { popis: "Montáž střešní konstrukce", jednotka: "m2", cena: 850 },
      { popis: "Montáž oken", jednotka: "ks", cena: 1900 },
      { popis: "Montáž dveří", jednotka: "ks", cena: 1500 },
      { popis: "Obložkové zárubně", jednotka: "ks", cena: 2200 },
      { popis: "Montáž schodiště", jednotka: "ks", cena: 18000 },
  ]},
  { key: "podlahar", name: "Podlahář", icon: "albums", tools: TOOLS.podlahar, items: [
      { popis: "Pokládka vinylové podlahy", jednotka: "m2", cena: 320 },
      { popis: "Pokládka laminátové podlahy", jednotka: "m2", cena: 280 },
      { popis: "Pokládka koberce", jednotka: "m2", cena: 250 },
      { popis: "Broušení parketu", jednotka: "m2", cena: 380 },
      { popis: "Lišty a ukončení", jednotka: "bm", cena: 140 },
  ]},
  { key: "sadrokartonar", name: "Sádrokartonář", icon: "layers", tools: TOOLS.sadrokartonar, items: [
      { popis: "SDK předstěna", jednotka: "m2", cena: 720 },
      { popis: "SDK příčka", jednotka: "m2", cena: 850 },
      { popis: "SDK podhled", jednotka: "m2", cena: 780 },
      { popis: "Opláštění sloupů", jednotka: "bm", cena: 950 },
      { popis: "Šachtování", jednotka: "bm", cena: 850 },
  ]},
  { key: "klempir", name: "Klempíř", icon: "umbrella", tools: TOOLS.klempir, items: [
      { popis: "Oplechování střechy", jednotka: "m2", cena: 950 },
      { popis: "Montáž okapů", jednotka: "bm", cena: 580 },
      { popis: "Parapety", jednotka: "ks", cena: 1200 },
      { popis: "Montáž střešních oken", jednotka: "ks", cena: 4800 },
  ]},
  { key: "dlazdic", name: "Dlaždič / Pokládač", icon: "apps", tools: TOOLS.dlazdic, items: [
      { popis: "Pokládka venkovní dlažby", jednotka: "m2", cena: 850 },
      { popis: "Obrubníky", jednotka: "bm", cena: 380 },
      { popis: "Zámková dlažba", jednotka: "m2", cena: 750 },
      { popis: "Štěrkový podsyp", jednotka: "m2", cena: 220 },
  ]},
  { key: "zamecnik", name: "Zámečník", icon: "shield-checkmark", tools: TOOLS.zamecnik, items: [
      { popis: "Montáž zábradlí", jednotka: "bm", cena: 1900 },
      { popis: "Montáž brány", jednotka: "ks", cena: 8500 },
      { popis: "Montáž garážových vrat", jednotka: "ks", cena: 12000 },
      { popis: "Montáž ocelové konstrukce", jednotka: "kg", cena: 95 },
  ]},
];
