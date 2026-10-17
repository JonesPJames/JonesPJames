# Řemeslník JARVIS — audit Android klienta

Datum: 17. 10. 2026. Zdroj: `JonesPJames/JonesPJames`, vývojová větev `work/jarvis-sop-api-20261014`, výchozí commit `dd6adbed8438f09d5d262f9acab1a4a3c0899752`.

## Potvrzené nálezy a opravy

| Priorita | Nález | Oprava |
|---|---|---|
| P1 | Workflow `assembleDebug` vytvářel vývojový APK vyžadující Metro. Úspěšný běh 39051960827 neobsahuje úlohu balení JS pro aplikaci. | Samostatné staging APK přes `:app:assembleRelease`; kontrola neprázdného `assets/index.android.bundle` a ověření podpisu před uploadem. |
| P1 | Chybí `frontend/package-lock.json`; instalace závislostí nebyla reprodukovatelná. | Verzovaný lockfile, `npm ci`, projektový `.npmrc` zachovávající dosavadní nastavení peer dependencies. Cache setup-node odkazuje na existující lockfile. |
| P1 | TypeScript 5.9 odmítá `ignoreDeprecations: "6.0"`; původní CI obcházelo problém stažením jiného kompilátoru. | Odstraněna neplatná volba; lokální uzamčený kompilátor a skript `typecheck`. |
| P1 | `@expo/config-plugins` 6.0.2 neodpovídá Expo SDK 54. | Verze `~54.0.4` dle `expo install --check`. |
| P2 | ESLint konfigurace vkládá pole Expo konfigurací do jiného pole. | Rozbalení flat config, vyloučení generovaných adresářů, lokální ESLint. |
| P2 | Mobilní CI se nespouštělo na pull requesty a filtry vynechávaly důležité změny. | Pull request spouštěče, všechny frontendové vstupy, omezená oprávnění, časové limity. |
| P2 | EAS profil neurčuje explicitně APK; CLI se stahovalo přes pohyblivé `latest`. | `android.buildType: apk`; EAS CLI 25.1.1. |

| P1 | První skutečný release build 39058801658 skončil na `:expo-manifests:lintVitalAnalyzeRelease` s `OutOfMemoryError: Metaspace`; vygenerovaná konfigurace má pouze 512 MiB metaspace. | JVM heap 3 GiB, metaspace 2 GiB, nejvýše 2 workers a vypnuté paralelní projekty v CI. Android lint zůstává zapnutý. |

Release varianta ve workflow je pouze interní testovací build. Expo prebuild generuje podpis testovacím debug klíčem; produkční podpis, identita aplikace ani keystore se nemění. Stávající applicationId `com.jpjones.remeslnikjarvis.debug` zůstává zachován.

## Ověření

- Reprodukována chyba TS5103 před opravou; po opravě `npm run typecheck` prochází.
- `expo install --check`: kompatibilní závislosti.
- `expo prebuild --platform android --no-install`: úspěch; zkontrolován vygenerovaný Gradle, Hermes, `export:embed`, release podpis a applicationId.
- `expo export --platform android`: úspěch, 1490 modulů, Hermes bundle přibližně 4,57 MB.
- 14 izolovaných Python testů JARVIS integrace, klientů a mobilního kontraktu: úspěch. Testy nepřipojují produkční server.
- Nativní Gradle kompilaci a kontrolu APK provádí GitHub Actions; lokální prostředí nemá Android SDK. Export JavaScriptu není důkazem úspěšného nativního sestavení ani funkčnosti na zařízení.
- EAS cloud build vyžaduje existující Expo oprávnění; nebyl spuštěn ani měněn účet Expo.

## Otevřené body

1. **P1 — závislosti:** první audit bez lockfile rozlišil 47 zranitelných balíčků; kompatibilní aktualizace pluginu snížila počet na 43 (24 high, 19 moderate). `npm audit fix` bez změny hlavních verzí další opravu nenabízí. Nejde o 43 nezávislých exploitačních cest; část řetězce je vývojová. Přechod Expo/React Native vyžaduje samostatnou kompatibilitní migraci. Nepoužívat automatické `--force`, které navrhuje i nekompatibilní downgrade Expo.
2. **P1 — architektura:** klient volá nakonfigurovaný JARVIS staging endpoint přímo. Jediný veřejný API Gateway musí být doložen routováním a síťovou konfigurací; samotná kontrola JWT to nedokazuje. Architektura se tímto PR nerozšiřuje ani nepřekresluje.
3. **P2 — produkční konfigurace:** `src/api.ts` má historický produkční fallback a `app.json` historickou backend URL. Testovací workflow i EAS preview nastavují staging URL explicitně. Produkční releasy potřebují samostatnou kontrolu konfigurace; testy zde nevolají žádnou z těchto služeb.
4. **P2 — tokeny:** Pro token se ukládá do AsyncStorage. Migrace na SecureStore, revokace a rotace tokenů patří do samostatného bezpečnostního kroku.
5. **P2 — repozitář:** Metro cache je již součástí historie. Nová pravidla zabraňují dalšímu přidávání; historická data se nemažou.
6. Ověřit instalaci a start na skutečném zařízení, přihlášení a komunikaci přes schválený gateway. Potvrzení změn klientů a zakázek zůstává zachováno.
7. **P2 — lint:** po opravě konfigurace ESLint nemá chyby, ale hlásí 22 existujících varování (nepoužité symboly, závislosti React hooks apod.). `npm run lint` s `--max-warnings 0` proto zatím neprochází; pravidla nebyla oslabena.
8. Výchozí `main` neobsahuje aktuální vývoj JARVIS. PR cílí na aktivní vývojovou větev; sloučení do produkční větve není součástí auditu.

Produkční databáze, prostředí, tajné údaje a nasazení nebyly měněny. Žádný test nevolá živé staging E2E skripty vytvářející účty nebo zakázky.

## Důkazy z nativního sestavení

První release CI 39058801658 úspěšně provedlo `:app:createBundleReleaseJsAndAssets` a zabalilo 1490 modulů do `index.android.bundle`. Následně selhalo při Android lint analýze třetí knihovny na vyčerpání 512 MiB JVM metaspace. Úprava limitů řeší konkrétní resource failure; výsledek opakované kompilace musí potvrdit nové CI. Kontroly lint ani podpisu se nevynechávají.

Samostatný `pip-audit` podpůrného Pro backendu navíc našel 7 zranitelných balíčků (50 odlišných kombinací balíček/advisory po deduplikaci). Patří sem PyMongo, python-jose, python-multipart, Pillow, PyJWT, Starlette a ecdsa. Úplný registr je v backendovém auditním PR `JonesPJames/remeslnik-jarvis#1`; produkční Python verze nebyly tímto mobilním PR měněny.
