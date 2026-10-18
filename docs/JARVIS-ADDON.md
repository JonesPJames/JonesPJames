# JARVIS v Řemeslník Pro

JARVIS je placená nadstavba uvnitř stávající aplikace. Základní asistent, založení klienta a zakázky s potvrzením zůstávají v omezeném režimu. Plný průvodce vyžaduje aktivní serverově ověřený přístup.

## Provozní tok

Zadání (popis + 3–5 fotografií + naměřené rozměry) → 2–3 varianty řešení → volitelná vizualizace před/po a schéma → upravitelný položkový rozpočet → potvrzení → zakázka v Řemeslníku Pro a jeho PDF nabídka. Rozměry se neodhadují z fotografií. Chybí-li nutné rozměry, plán vyžádá doplnění.

Pro API je veřejný vstup mobilního klienta. Proxy `/api/jarvis/assistant` a placené operace volají privátní AI službu. AI služba ověřuje identitu a znovu ověřuje předplatné delegovaným voláním Pro API. JARVIS neobsahuje databázového klienta. Pro uchovává návrhy a přístup ve své kolekci `settings`; provozní zakázky ve `jobs`. Zrušení nebo expirace přístupu neodstraňuje uživatelská data. Převod návrhu používá deterministické ID zakázky a rezervaci, takže opakování požadavku vrací původní zakázku.

## Konfigurace Pro API

- `JARVIS_API_URL`: interní URL AI služby (Railway private networking); bez cesty.
- `JARVIS_GATEWAY_SECRET`: sdílené podepisování identity (existující).
- `JARVIS_GATEWAY_ISSUER`, `JARVIS_GATEWAY_AUDIENCE`: hodnoty odpovídající AI službě, výchozí staging kontrakt.
- `JARVIS_INTEGRATION_SECRET`: delegované ověření uživatele (existující).
- Volitelně `JARVIS_LICENSE_SECRET`: alespoň 32 znaků, nikdy do mobilu. Podporuje vydané časově omezené aktivační JWT s `iss=remeslnik-billing`, `aud=jarvis-addon`, `sub=<Pro user ID>`, `plan=jarvis-full`, `jti`, `iat`, `exp`. Tento provozní aktivační mechanismus sám neúčtuje platby.

## Předplatné a účtování

Implementace Stripe Hosted Checkout a Customer Portal je připravená. Přímý prodej je vypnutý, dokud nejsou nastaveny všechny čtyři proměnné:

- `STRIPE_SECRET_KEY`
- `STRIPE_JARVIS_PRICE_ID`: existující opakovaná cena produktu JARVIS; cena se nenastavuje v klientovi.
- `STRIPE_WEBHOOK_SECRET`
- `JARVIS_BILLING_RETURN_URL`: HTTPS návratová stránka bez parametrů.

Webhook: `POST /api/jarvis/billing/webhook`. Odebírat `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. Použitá verze Stripe API je `2024-06-20`. Podpis se ověřuje nad původním tělem s časovou tolerancí 300 sekund. Každá relevantní událost vyvolá načtení aktuálního předplatného ze Stripe; shodovat se musí ID produktu/ceny i serverově připojené ID účtu. Neaktivní předplatné nezpřístupní plný režim. Opakované doručení je bezpečné. Cena, merchant účet a živá platba nejsou součástí kódu a nebyly ověřeny živým účtováním.

Android APK je interní testovací distribuce. Tato integrace není hotovou integrací Google Play Billing; před distribucí přes Google Play musí být digitální předplatné zapojeno do příslušného distribučního modelu.

## Konfigurace AI služby

- Existující `JWT_SECRET`, `GATEWAY_JWT_ISSUER`, `GATEWAY_JWT_AUDIENCE`, `JARVIS_INTEGRATION_SECRET`, `PRO_INTEGRATION_API_URL`.
- `OPENAI_API_KEY`, případně `JARVIS_AI_MODEL` (výchozí `gpt-4.1-mini`).
- `JARVIS_IMAGE_MODEL` pro OpenAI Images (výchozí `gpt-image-1`, JPEG 1024 px, nízká kvalita).
- Volitelný `LOVABLE_API_KEY` zachová původního poskytovatele vizualizací. Jinak se používá OpenAI Images.

Výpadek AI nesmí v placeném průvodci vymyslet náhradní ceny nebo měření. Vrátí chybu a uložený návrh zůstane dostupný pro opakování. Živé generování je závislé na oprávnění modelu, platném klíči a kreditu poskytovatele.

## Ověření

Python testy pokrývají přístup, cizí a expirované licence, oddělení účtů, obnovu návrhu, jednorázové založení zakázky, validaci fotografií/cen a podepisování platebních webhooků včetně aktivace a zrušení. Node testy ověřují autentizaci, placený přístup před AI voláním, všechny dodané fotografie, validaci odpovědí a odmítnutí chybějících rozměrů. Mobilní kontroly zahrnují TypeScript, ESLint a existující regresní testy adresáře/zakázek.
