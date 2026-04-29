# Řemeslník Pro 1.0 — PRD

## Overview
Mobile-first Czech-language Expo app for Czech tradespeople (řemeslníci) to manage cenové nabídky, stavební deníky and celkové vyúčtování end-to-end.

## Stack
- **Frontend**: Expo (React Native) with Expo Router (TypeScript)
- **Backend**: FastAPI (`/app/backend/server.py`)
- **DB**: MongoDB (`remeslnik_pro` database)
- **AI**: Claude Sonnet 4.5 via `emergentintegrations` + Emergent LLM Key
- **PDF**: ReportLab (server-side, Czech diacritics via DejaVu)

## Auth (custom JWT)
- Register: email + password + name + company + phone
- Login → returns JWT (30-day) stored in AsyncStorage as `rp_token`
- Protected routes via `Authorization: Bearer …` header
- PDF endpoints additionally accept `?token=` query param for `Linking.openURL`

## Features
1. **Adresář zakázek** — search, status filter chips (Vše / Rozpracováno / Schváleno / Odloženo / Dokončeno / Expirováno), color-coded status badges, expiry countdown for Odloženo.
2. **Nová zakázka / Zakázka detail** — auto-generated job number `YYYY-NNN`, live summary card (Práce / Materiál / Doprava / CELKEM), three editable line-item tables, AI material price suggestion (Claude), status transitions (Schváleno / Odloženo / Dokončeno), debounced auto-save, PDF download.
3. **Stavební deník** — auto-available when status=Schváleno; daily entries (date / work / weather / workers / notes / optional photo via Image Picker base64), Vícepráce + Materiál navíc tables auto-rolling into vyúčtování.
4. **Celkové vyúčtování** — multi-section view (Original / Vícepráce / Diary excerpt / Recap), 📷 photo URL field, "Finalizovat a uzamknout" lock, billing PDF.
5. **Kalkulačka prací** — 11 trades with preset items (Zedník, Obkladač, Malíř, Elektrikář, Instalatér, Tesař, Podlahář, Sádrokartonář, Klempíř, Dlaždič, Zámečník), add custom rows, total, export to Nová zakázka.
6. **Generátor nabídek** — AI generates 3 variants (🥉 Základní / 🥇 Zlatá střední cesta / 💎 Premium), each with title/price/scope/warranty/term/included/excluded; PDF with all 3 variants.
7. **Import z Řemeslník AI** — JSON import `{ cinnost, parametry, material[], pracovni_postup[], cas_hodiny }` → prefills Materiál + Práce in new job.
8. **Profil** — edit name, company, phone; logout.

## Status state machine
- `rozpracovano` (default) → editable
- `odlozeno` → records `postponed_at`; 30-day validity countdown; ≥30 days → `expirovano` (red); "Obnovit" resets timer
- `schvaleno` → green; unlocks deník
- `dokonceno` → unlocks vyúčtování; remains editable until "Finalizovat a uzamknout"

## Design
- Off-white background `#f4f1eb`, orange accent `#c9820a`, rounded cards (20px), warm shadows
- Native Ionicons
- Min touch target 56-60px (rugged tradespeople usability)
- Mobile-first layout

## Currency / Date
- Currency: `Kč` (formatted `1 000 Kč`)
- Date: `D. M. YYYY`
