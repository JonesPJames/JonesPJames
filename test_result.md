#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Řemeslník Pro 1.0 — kompletní E2E audit po hlášení uživatele, že nelze přiřadit
  zaměstnance k zakázce. Nutno: ověřit auth (owner+PIN), kalkulačku 13 profesí,
  novou zakázku + autosave, AI generátor (A>=base, B<=A*1.15, C<=B*1.20, max 48m záruka),
  přiřazování zaměstnanců, employee flow (checklist nářadí, deník, vícepráce),
  schvalování víceprací, vyúčtování (editovatelné, bez 14d splatnosti, drive odkaz),
  PDF exporty (copyright "Vytvořil © James P. Jones 2026"), UI patička.

backend:
  - task: "Auth - owner login + employee PIN login"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Endpointy /api/auth/login, /api/auth/login-pin, /api/auth/me, /api/auth/me-employee. Test creds: admin@remeslnikpro.cz/admin123, PIN 4998."
        -working: true
        -agent: "testing"
        -comment: "PASS - owner login admin@remeslnikpro.cz/admin123 OK, /auth/me s Bearer OK, bez tokenu vrací 401, PIN 4998 přihlásí ZAM-001 (Petr Šimek), /auth/me-employee OK, owner token na /me-employee správně 403, neplatný PIN vrací 401."

  - task: "Job assignment endpoint /jobs/{id}/assign"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "PUT /api/jobs/{id}/assign s body {employee_ids:[]}. Vyžaduje status='schvaleno'. Otestovat s validním a nevalidním ID + se statusem != schvaleno."
        -working: true
        -agent: "testing"
        -comment: "PASS - Při statusu rozpracovano vrací 400 s 'Zaměstnance lze přiřadit jen ke schválené zakázce'. Po PUT status=schvaleno přiřazení ZAM-001 OK; GET /jobs/{id} obsahuje assigned_employee_ids=['ZAM-001']."

  - task: "AI generator - math limits + 48m warranty cap"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "POST /api/ai/generate-variants - server clamps A>=base, B<=A*1.15, C<=B*1.20, warranty<=48m. Otestovat strukturu odpovědi a invarianty."
        -working: true
        -agent: "testing"
        -comment: "PASS - base=41500, A=43200, B=47500 (<=A*1.15=49680), C=54600 (<=B*1.20=57000). Záruky 24/36/48 měsíců, žádná nepřekročila 48m. Server-side klampy fungují bez ohledu na výstup LLM."

  - task: "Employee tool checklist + diary + propose-vicepracovne"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Endpointy: PUT /api/employee/jobs/{id}/checklist (lze měnit jen do confirm), POST .../checklist/confirm (nelze měnit znovu - 400), POST .../diary, POST .../propose-vicepracovne."
        -working: true
        -agent: "testing"
        -comment: "PASS - PUT checklist (1st) OK, POST checklist/confirm OK, druhý PUT po confirm vrací 400 'Checklist je již potvrzen'. POST diary i propose-vicepracovne vrací 200 a perzistují. GET /employee/jobs vrací jen přiřazené zakázky a strip-prices skrývá ceny v prace[] i material[]."

  - task: "Owner approval/reject of vicepracovne proposals"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "POST /api/jobs/{id}/proposals/{pid}/resolve - approve s cenou propíše do vicepracovne tabulky."
        -working: true
        -agent: "testing"
        -comment: "PASS - approve s cena=1500 přidá nový řádek do job.vicepracovne s odpovídající cenou; návrh se označí jako approved."

  - task: "Job CRUD + auto-save (PUT /jobs/{id}) + photo_url + payment_note"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Pole photo_url a payment_note se propisují, 14d splatnost odstraněna (cleanup migrace v server.py)."
        -working: true
        -agent: "testing"
        -comment: "PASS - POST /jobs vytvoří job s číslem 2026-003. Autosave všech 11 polí (client_name, address, title, photo_url, payment_note, prace, material, doprava, vicepracovne, material_navic, diary_entries) každé samostatným PUT vrací 200 a hodnoty jsou perzistentní. DELETE /jobs/{id} OK. Migrace 14d splatnosti: 0 jobů s 'Splatnost 14 dní od vystavení faktury.' v DB."

  - task: "PDF generation - quote + billing - copyright footer"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "GET /api/jobs/{id}/pdf, /api/jobs/{id}/billing-pdf, /api/quote-variants/{id}/pdf. Všechny musí obsahovat string 'Vytvořil © James P. Jones 2026'."
        -working: true
        -agent: "testing"
        -comment: "PASS - Všechny 3 PDF endpointy podporují ?token= autorizaci, vrací application/pdf. Po extrakci textu pomocí pypdf všechny obsahují řetězec 'James P. Jones 2026': quote PDF (3035B), billing PDF (4431B), variants PDF (4944B)."

frontend:
  - task: "Global UI footer (copyright)"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/components/AppFooter.tsx + 14 screens"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Vytvořena AppFooter komponenta. Vložena na všechny obrazovky včetně login. Ověřeno screenshot — footer viditelný."

  - task: "Job detail - Assign employees UI"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/zakazka/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: false
        -agent: "main"
        -comment: "Před opravou: funkce toggleAssign existovala, ale UI nebylo vyrenderováno - majitel neměl jak přiřadit zaměstnance."
        -working: "NA"
        -agent: "main"
        -comment: "Opraveno: přidána sekce 'Přiřazení zaměstnanci' s checkboxy (visible u status schvaleno/dokonceno) + souhrn nářadí pod každým přiřazeným."

  - task: "Job detail - Vicepracovne proposals UI"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/zakazka/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: false
        -agent: "main"
        -comment: "Před opravou: resolveProposal funkce existovala, ale UI seznamu návrhů chybělo."
        -working: "NA"
        -agent: "main"
        -comment: "Opraveno: přidán panel 'Návrhy víceprací od zaměstnanců' s tlačítky Schválit+cena / Zamítnout."

  - task: "Vyúčtování screen - editable note + photo URL"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/vyuctovani/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: false
        -agent: "main"
        -comment: "Před opravou: screen používal nedefinované proměnné photoUrl/onChangePhoto/paymentNote/onChangeNote — JS error při vykreslení."
        -working: "NA"
        -agent: "main"
        -comment: "Opraveno: doplněn useState pro photoUrl/paymentNote a debounced autosave."

metadata:
  created_by: "main_agent"
  version: "1.2"
  test_sequence: 2
  run_ui: false

backend:
  - task: "Auth - PIN login s company_code (v2)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "testing"
        -comment: "PASS všech 7 sub-testů (A.1-A.7). {JG756Z, 4998} → 200 ZAM-001 Petr Šimek (cc=JG756Z); lowercase {jg756z, 4998} → 200 (case-insensitive .upper() funguje); WRONG1+4998 → 401 'Neplatný identifikátor firmy nebo PIN'; JG756Z+0000 → 401; ''+4998 → 400 'Zadejte identifikátor firmy (6 znaků)'; JG756Z+'12' → 400 'PIN musí mít 4 číslice'; bez company_code → 400."

  - task: "Register vytváří unique company_code (v2)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "testing"
        -comment: "PASS B.1-B.3. POST /auth/register vrací user.company_code=6znaků z abecedy [ABCDEFGHJKMNPQRSTUVWXYZ23456789] (bez 0/O/1/I/L). GET /auth/me vrací stejné kódování. Vytvořeno 6 účtů → všech 6 unique company_codes (REFFGV, R73KUG, GN2W3D, 722V7U, XXEZFB, T83VZH)."

  - task: "Multi-tenant izolace - 2 firmy se stejným PINem (v2)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "testing"
        -comment: "PASS C.1-C.8. Klíčový test: vytvořeny 2 firmy A (7958NF) a B (2CKXYG), v firmě A založen Honza A s PIN 7169. V firmě B vytvořeno 30 zaměstnanců bez PIN-collision chyby; následně přes přímý DB insert vynucen duplicitní PIN 7169 v firmě B (ZAM-FORCE-99) — kompozitní index (owner_user_id, pin) povolí. Login {code_a, 7169} → vrátí Honza A (ZAM-001 z firmy A); login {code_b, 7169} → vrátí ZAM-FORCE-99 z firmy B (NIKDY ne Honzu A); cross login {code_a, pin existující jen v B} → 401 'Neplatný identifikátor firmy nebo PIN'. Multi-tenancy 100% správně izolovaná."

  - task: "DELETE /api/employees/{id} (regrese, v2)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "testing"
        -comment: "PASS D.0-D.3. POST /employees vytvoří, DELETE /employees/{id} → 200 {ok: true}, GET /employees neobsahuje smazaného, DELETE /employees/INVALID → 404."

  - task: "POST /api/employees ukládá owner's company_code (v2)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "testing"
        -comment: "PASS E.1. POST /employees u admin (company_code=JG756Z) → response.company_code=JG756Z. Doc je správně persistován s company_code z user.company_code."

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: |
       Po E2E auditu nalezeny 4 bugy a opraveny:
       1) UI pro přiřazení zaměstnanců v zakazka/[id].tsx zcela chybělo (jen funkce, žádný JSX) — DOPLNĚNO.
       2) UI pro schvalování víceprácí v zakazka/[id].tsx zcela chybělo — DOPLNĚNO.
       3) vyuctovani/[id].tsx odkazoval na nedefinované proměnné photoUrl/paymentNote — OPRAVENO (přidán useState + debounced autosave).
       4) Globální copyright patička "Vytvořil © James P. Jones 2026" chyběla v UI — DOPLNĚNA na všechny obrazovky (AppFooter.tsx).
       Backend (assign endpoint, AI clamp, 48m záruka, PDF copyright) byl OK už dříve, ale prosím ověř všechny endpointy v test_plan a 100% PDF obsahuje copyright string.
       Test creds: owner admin@remeslnikpro.cz / admin123; employee PIN 4998.
    -agent: "testing"
    -message: |
       Backend kompletně otestován - 49/49 testů PASS proti veřejné URL (https://tradesmen-quotes.preview.emergentagent.com/api).
       Testovací suite v /app/backend_test.py pokrývá:
       1) Auth: owner login (admin@remeslnikpro.cz/admin123), /auth/me, PIN login (4998 → ZAM-001 Petr Šimek), /auth/me-employee, kontrola 401/403 negativních scénářů.
       2) Job CRUD + auto-save: POST /jobs, PUT autosave všech 11 polí (client_name, address, title, photo_url, payment_note, prace, material, doprava, vicepracovne, material_navic, diary_entries), GET, DELETE.
       3) Assign endpoint: 400 když status != schvaleno, OK po schválení; assigned_employee_ids perzistuje a vrací se v GET.
       4) AI generator: base=41500, A=43200, B=47500 (≤A*1.15), C=54600 (≤B*1.20); záruky 24/36/48 měsíců. Server-side klampy fungují.
       5) Employee flow: GET /employee/jobs (bez cen), PUT checklist OK, confirm OK, druhý PUT po confirm = 400, diary OK, propose-vicepracovne OK.
       6) Owner approve proposal s cena=1500 → propíše se do job.vicepracovne.
       7) PDF endpointy: všechny 3 (quote, billing, variants) podporují ?token= autorizaci, vrací application/pdf, obsahují řetězec "James P. Jones 2026" (ověřeno přes pypdf extract_text).
       8) Migrace 14d splatnosti: 0 jobů s "Splatnost 14 dní od vystavení faktury." v DB.
       Žádné kritické bugy. Backend je zelený.
    -agent: "testing"
    -message: |
       V2 multi-tenant testing dokončen — 36/36 testů PASS proti veřejné URL (https://tradesmen-quotes.preview.emergentagent.com/api). Test suite: /app/backend_test_v2.py.

       A) /auth/login-pin s company_code (7/7 PASS):
         - {JG756Z, 4998} → 200 ZAM-001 Petr Šimek (cc=JG756Z)
         - case-insensitive {jg756z, 4998} → 200 (backend .upper() funguje)
         - {WRONG1, 4998} → 401 'Neplatný identifikátor firmy nebo PIN'
         - {JG756Z, 0000} → 401
         - {'', 4998} → 400 'Zadejte identifikátor firmy (6 znaků)'
         - {JG756Z, '12'} → 400 'PIN musí mít 4 číslice'
         - {pin: 4998} bez company_code → 400 'Zadejte identifikátor firmy'

       B) Register vytváří unique company_code (3/3 PASS):
         - 6-znakový string z abecedy [ABCDEFGHJKMNPQRSTUVWXYZ23456789] (žádné 0/O/1/I/L)
         - GET /auth/me vrací stejný code jako z register
         - 6 paralelně vytvořených účtů → 6 unique kódů

       C) Multi-tenant izolace - KLÍČOVÝ TEST (8/8 PASS):
         - Vytvořeny firmy A (7958NF) a B (2CKXYG), každá s vlastním adminem.
         - 30 zaměstnanců v firmě B vytvořeno bez kolize indexu.
         - Vynucený duplicitní PIN přes přímý DB insert (kompozitní index (owner_user_id, pin) povolí) → ZAM-FORCE-99 v B se stejným PINem jako Honza A v A.
         - Login {code_a, PIN_A} → vrátí Honza A.
         - Login {code_b, PIN_A} → vrátí ZAM-FORCE-99 z B (NIKDY ne Honza A).
         - Cross-login {code_a, PIN existující jen v B} → 401.
         Multi-tenancy 100% bezpečně izolovaná.

       D) DELETE /api/employees/{id} regrese (4/4 PASS): 200, GET nezahrnuje, INVALID → 404.

       E) POST /api/employees ukládá owner.company_code (1/1 PASS): emp.company_code=JG756Z u admin.

       F) Regrese (10/10 PASS): /auth/login owner, /auth/me obsahuje company_code, admin code = JG756Z, POST /jobs OK, AI invarianty A>=base, B<=A*1.15, C<=B*1.20, záruky max 48m, všechny 3 PDF endpointy obsahují 'James P. Jones 2026' (ověřeno přes pypdf extract_text).

       Test data po sobě uklizena (ZAM-FORCE-99 odstraněn, testovací jobs deleted). Žádné kritické bugy. Backend v2 zelený.
    -agent: "main"
    -message: |
       NOVÉ ZMĚNY (v2): Multi-tenancy přes company_code.
       1) PIN login NYNÍ vyžaduje company_code (6 znaků) + PIN. Endpoint /api/auth/login-pin přijímá {company_code, pin}.
       2) Při registraci se generuje 6-znakový unique company_code (abeceda bez 0/O/1/I/L).
       3) Migrace na startu: stávající users a employees dostali company_code (admin → JG756Z).
       4) Index pin_1 (globální unique) shozen, nahrazen kompozitním (owner_user_id, pin) — různé firmy mohou mít stejný PIN.
       5) Frontend: login screen má 2 inputy (company_code + PIN); zamestnanci má kartu s firma codem + Kopírovat; profil zobrazuje code; mazání zaměstnance opraveno (window.confirm na webu).
       Test creds: admin@remeslnikpro.cz/admin123 + code=JG756Z, employee PIN 4998 + code=JG756Z.
       Otestuj prosím:
       a) POST /auth/register vytvoří user s neprázdným unique company_code; GET /auth/me ho vrací.
       b) POST /auth/login-pin: 400 bez code, 401 se špatným code, 200 se správnou kombinací; case-insensitive vstup company_code.
       c) Multi-tenant izolace: registruj 2. ownera, vytvoř u něj employee s identickým PINem jako má 1. firma → MUSÍ projít, login s každým company_code vrátí svého employee.
       d) DELETE /api/employees/{id} stále funguje (regrese).
       e) POST /api/employees uloží company_code z ownera.