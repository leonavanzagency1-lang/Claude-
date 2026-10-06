# Offert från platsbesöket

Ett lokalt verktyg för hantverkare och byggfirmor. Efter platsbesöket spelar du in ett röstmemo, tar foton och/eller skriver anteckningar. Systemet transkriberar ljudet, låter Claude tolka underlaget till ett **offertutkast** som du granskar och justerar, och tar fram en PDF i firmans utseende.

> Version 1 körs lokalt och är avsedd för test av en användare. Systemet skickar aldrig något till kunder – du laddar ned PDF:en och skickar den själv.

## Innehåll

- [Krav](#krav)
- [Installation](#installation)
- [Miljövariabler](#miljövariabler)
- [Starta](#starta)
- [Använda appen i mobilen](#använda-appen-i-mobilen)
- [Tester och kodkontroll](#tester-och-kodkontroll)
- [Mock-läget](#mock-läget)
- [Så fungerar flödet](#så-fungerar-flödet)
- [Viktiga principer](#viktiga-principer)
- [Projektstruktur](#projektstruktur)
- [Kända begränsningar](#kända-begränsningar)
- [Förslag på förbättringar](#förslag-på-förbättringar)

## Krav

- Node.js 20.9 eller senare (testat med Node 22)
- npm

## Installation

```bash
npm install                 # installerar beroenden och genererar Prisma-klienten
cp .env.example .env        # skapa din lokala konfiguration
npm run db:setup            # skapar databasen (prisma/dev.db) och lägger in seed-data
```

`npm run db:setup` kan köras flera gånger. Exempelfirman skapas bara om den saknas, exempelartiklarna uppdateras och exempelplatsbesöket läggs in bara om det inte finns några offerter.

Vill du börja om från en tom databas: `npm run db:reset`. **Det raderar all data i `prisma/dev.db`.**

### Seed-data

- **Exempelfirma** – "Exempelbygg AB" med fiktiva uppgifter, timpris 650 kr och moms 25 %. ROT-fälten är tomma.
- **Prislista** – 23 artiklar för altaner och tillbyggnader (arbete, material och övrigt). Alla är märkta **exempelpris** och priserna är påhittade. Byt till dina egna priser.
- **Exempelplatsbesök** – kunden "Anna Andersson" med anteckningar, redo för AI-tolkning.

## Miljövariabler

Alla variabler finns, med kommentarer, i [`.env.example`](.env.example).

| Variabel | Beskrivning |
| --- | --- |
| `DATABASE_URL` | SQLite-fil, standard `file:./dev.db` (relativt mappen `prisma/`). |
| `MOCK_AI` | `true` = inga externa anrop. Exempeltranskribering och exempelsvar används. |
| `ANTHROPIC_API_KEY` | Nyckel till Anthropics API (Claude). |
| `ANTHROPIC_MODEL` | Modellnamn, t.ex. `claude-opus-5-5` (aktuellt enligt Anthropics dokumentation i oktober 2026). |
| `ANTHROPIC_EFFORT` | Valfritt: `low`, `medium`, `high`, `xhigh` eller `max`. Tomt = modellens standard. |
| `OPENAI_API_KEY` | Nyckel till OpenAI:s transkriberings-API. |
| `OPENAI_TRANSCRIBE_MODEL` | Transkriberingsmodell, standard `gpt-4o-transcribe`. |
| `UPLOAD_DIR` | Mapp för uppladdade filer, standard `./uploads` (ignoreras av git). |
| `DEV_ALLOWED_ORIGINS` | Valfritt: datorns IP-adress, så att mobilen kan nå utvecklingsservern. |

API-nycklarna läses bara på serversidan (`src/lib/config.ts` och modulerna för AI och transkribering). De skickas aldrig till webbläsaren.

## Starta

```bash
npm run dev
```

Öppna sedan <http://localhost:3000>. Börja gärna med **Inställningar** (firmauppgifter, logotyp och eventuellt ROT) och **Prislista** (dina egna priser).

Produktionsbygge, om du vill: `npm run build && npm start`.

## Använda appen i mobilen

Platsbesöket görs i mobilen, så gränssnittet är byggt för smala skärmar. Webbläsare tillåter bara mikrofonen på **HTTPS** eller `localhost`. Gör så här för att spela in från mobilen mot datorn i samma nätverk:

1. Ta reda på datorns IP-adress, t.ex. `192.168.1.20`.
2. Lägg in den i `.env`: `DEV_ALLOWED_ORIGINS=192.168.1.20`
3. Starta med HTTPS: `npm run dev:https`. Det använder Next.js inbyggda `--experimental-https` med ett självsignerat certifikat och lyssnar på alla nätverkskort.
4. Öppna `https://192.168.1.20:3000` i mobilen och godkänn certifikatvarningen.

Om inspelning inte går att använda kan du alltid ladda upp en ljudfil, t.ex. från telefonens röstmemo-app.

## Tester och kodkontroll

```bash
npm test             # Vitest – alla tester
npm run typecheck    # TypeScript (strict)
npm run lint         # ESLint
npm run check        # allt ovan i följd
```

Testerna skapar en egen databas, `prisma/test.db`, som byggs om vid varje körning. Utvecklingsdatabasen påverkas inte. Inga API-nycklar behövs.

Det här testas:

| Fil | Innehåll |
| --- | --- |
| `tests/calc.test.ts` | Moms, påslag, avrundning till hela ören, ROT med och utan maxbelopp, flera personer, tomma offerter, rader med mängd 0 och rader utan pris |
| `tests/ai-schema.test.ts` | Zod-validering av AI-svar: giltiga, felaktiga, ofullständiga, fel typer, ogiltig JSON och pris som AI:n försöker smyga in |
| `tests/interpret.test.ts` | Nytt försök vid ogiltigt svar, tydligt fel efter två misslyckanden och koppling till prislistan (priser bara från prislistan eller timpriset) |
| `tests/readiness.test.ts` | Spärren som hindrar att offerten markeras som granskad |
| `tests/csv.test.ts` | CSV-export och CSV-import av prislistan, inklusive felhantering per rad |
| `tests/flow.test.ts` | Hela flödet i mock-läge mot en riktig databas, och att PDF:ens summor är identiska med skärmens |
| `tests/external-errors.test.ts` | Felhantering mot OpenAI och Anthropic (nätverksfel, timeout, felkoder, saknade nycklar) |
| `tests/pdf-text.test.ts` | Teckenhantering i PDF:en |

## Mock-läget

Med `MOCK_AI=true` (standard i `.env.example`) går hela flödet att köra utan API-nycklar:

- **Transkribering** returnerar en fast exempeltranskribering (`src/lib/ai/mock.ts`) för varje ljudfil, oavsett vad du spelat in. Har du laddat upp två ljudfiler kommer texten alltså två gånger.
- **AI-tolkningen** returnerar ett fast exempelsvar som hänvisar till artikelnummer i seed-prislistan. Svaret går igenom **samma Zod-validering och koppling till prislistan** som ett riktigt svar, så du ser hur rader utan artikel, rader med låg säkerhet och mängder som saknas markeras.

Sätt `MOCK_AI=false` och fyll i `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` och `OPENAI_API_KEY` för att använda de riktiga tjänsterna. Starta om `npm run dev` efter att du ändrat `.env`.

## Så fungerar flödet

1. **Inställningar** (en gång) – firmauppgifter, logotyp, F-skatt, betalningsvillkor, giltighetstid, standardtexter, timpris, momssats och ROT. ROT-fälten är tomma från början och märkta med "Kontrollera aktuella regler hos Skatteverket".
2. **Prislista** – lägg till, ändra, ta bort, importera och exportera som CSV (semikolonseparerad med decimalkomma, öppnas direkt i svenska Excel). Kolumner: `artikelnummer;namn;typ;enhet;a_pris_exkl_moms;paslag_procent;exempelpris`.
3. **Nytt platsbesök** – kundens namn, adress, telefon, e-post och fastighetsbeteckning (valfri).
4. **Underlag** – spela in röstmemo i webbläsaren, ladda upp ljudfiler och foton, och skriv anteckningar. Minst ett underlag krävs. Foton förminskas och platsdata (EXIF/GPS) tas bort.
5. **Transkribering** – ljudet transkriberas på svenska och visas som redigerbar text.
6. **AI-tolkning** – Claude får transkribering, anteckningar, foton (högst 10) och prislistan, dvs. artikelnummer, namn, typ och enhet men inga priser. Claude svarar med strukturerad JSON som valideras med Zod. Är svaret ogiltigt görs ett nytt försök där felet skickas med. Misslyckas även det visas ett begripligt fel.
7. **Granskning** – underlaget och offertraderna visas sida vid sida (i mobilen under varandra). Rader med låg säkerhet, utan kopplad artikel eller utan pris markeras i rött. Du kan ändra, lägga till, ta bort och flytta rader, välja artikel ur prislistan och redigera alla texter. Offerten kan inte markeras som **granskad** förrän:
   - alla rader har pris
   - rader med låg säkerhet och rader utan artikel är bekräftade (kryssrutan "Bekräftad")
   - kunden har ett namn och offerten har minst en rad
8. **Beräkning** – sker bara i TypeScript (`src/lib/calc/`), i hela ören. Summorna visas live medan du redigerar. Om ROT är aktiverat och ifyllt visas ett preliminärt ROT-avdrag med texten "Preliminärt ROT-avdrag, förutsätter att kunden har utrymme kvar".
9. **PDF** – logotyp, offertnummer (`ÅÅÅÅ-löpnummer`), datum, giltighetstid, kunduppgifter, sammanfattning, rader, summor, antaganden, vad som inte ingår och villkor. Vill du ha med en bild (t.ex. en 3D-visualisering) hamnar den på en egen sida.
10. **Översikt** – alla offerter med status, kund, belopp och datum. Statusen ändras manuellt.

## Viktiga principer

- **Inga priser från AI:n.** Schemat som Claude svarar enligt saknar prisfält, och extra fält tas bort vid valideringen. Priser kopieras från prislistan (`prislista`), firmans timpris (`timpris`, för arbetstimmar utan artikel) eller skrivs in av dig (`manuell`). Prisets källa visas på varje rad.
- **Inga påhittade mängder.** Prompten kräver att mängder som inte går att härleda lämnas tomma och läggs som oklarheter. En rad utan mängd får mängd 0 och låg säkerhet.
- **Avrundning.** Belopp lagras i ören, procentsatser i baspunkter och mängder i tusendelar, alla som heltal. Varje rad avrundas till hela ören (halva uppåt). Påslag beräknas per rad. Moms beräknas på summan exkl. moms. ROT beräknas på arbetsradernas belopp inklusive påslag och moms, och begränsas av maxbelopp × antal personer.
- **Samma beräkning överallt.** Skärmen, översikten och PDF:en använder samma funktion (`calcQuote`). Ett test kontrollerar att PDF:ens summor är identiska med skärmens.
- **Personuppgifter** lagras bara lokalt (SQLite och `uploads/`). De skickas bara till Anthropic (AI-tolkning) och OpenAI (transkribering), och aldrig i mock-läget. Transkriberingen kan innehålla det som sägs i röstmemot, inklusive namn.
- **Låsning.** En offert med status skickad, accepterad eller avböjd kan inte redigeras. Ändra statusen till utkast först. Ändrar du rader i en granskad offert går den tillbaka till utkast.

## Projektstruktur

```
prisma/
  schema.prisma          datamodell (Company, Article, Quote, QuoteLine, Attachment, QuoteCounter)
  seed.ts                exempelfirma, prislista och platsbesök
src/
  app/                   sidor (App Router) och API-routes under app/api/
  components/            gemensamma UI-komponenter (bl.a. röstinspelning)
  lib/
    calc/                deterministisk beräkning och formatering av belopp
    ai/                  Zod-schema, prompt, Claude-klient, nytt försök, koppling till prislistan, mock
    transcription/       utbytbart gränssnitt + OpenAI-implementation + mock
    pdf/                 PDF-modell och -layout (@react-pdf/renderer)
    csv/                 import och export av prislistan
    quote/readiness.ts   regler för när en offert får markeras som granskad
    services/            affärslogik mot databasen (används av API och tester)
tests/                   Vitest
uploads/                 uppladdade filer (skapas automatiskt, ignoreras av git)
```

### Byta transkriberingstjänst

Implementera gränssnittet `Transcriber` i `src/lib/transcription/types.ts` och returnera den nya implementationen från `getTranscriber()` i `src/lib/transcription/index.ts`. Inget annat behöver ändras.

## Kända begränsningar

- **Bara en användare, ingen inloggning.** Appen är tänkt att köras lokalt. Exponera den inte mot internet.
- **Rättsliga och skattemässiga regler kontrolleras inte.** ROT-procentsats och maxbelopp anger du själv. Avdraget är preliminärt och tar inte hänsyn till hur mycket kunden redan har använt.
- **En momssats per offert.** Alla rader använder firmans momssats.
- **Påslag visas som en egen summarad.** Radernas belopp i PDF:en är exkl. påslag. Vill du visa kunden priser där påslaget redan är inräknat behövs en ändring.
- **Foton till AI:n** är begränsade till de 10 första per offert. De förminskas till högst 1568 px.
- **Ljudfiler** får vara högst 25 MB (OpenAI:s gräns), ungefär en timmes inspelning i webbläsarens format. Längre memon behöver delas upp.
- **HEIC-bilder** (iPhone-format) stöds inte vid direkt uppladdning från en dator. Mobilens webbläsare konverterar normalt till JPEG automatiskt.
- **Strukturerade svar.** Anthropics API följer JSON-schemat, men vissa begränsningar (t.ex. tillåtna enheter) skickas som beskrivningar i schemat och kontrolleras sedan av Zod. Ett ogiltigt svar ger ett nytt försök, och därefter ett felmeddelande.
- **Säkerhetsfilter.** Om Claude avböjer att svara visas ett felmeddelande. Ingen automatisk reservmodell används.
- **PDF-typsnittet** är Helvetica. Tecken utanför den västeuropeiska teckenuppsättningen (t.ex. ≈) ersätts med närliggande tecken.
- **Offertdatum** i PDF:en är dagens datum när PDF:en skapas, och giltighetstiden räknas från det.
- **Ingen automatisk säkerhetskopiering.** Säkerhetskopiera `prisma/dev.db` och `uploads/` själv.

## Förslag på förbättringar

Inte byggda i v1:

1. Inloggning och flera användare, samt drift på en server med HTTPS.
2. Offertmallar och paket (t.ex. "Altan 20 m² standard") som förifyllda rader.
3. Spara en ögonblicksbild av varje nedladdad PDF och visa versionshistorik per offert.
4. Valbart om påslag ska visas separat eller räknas in i à-priserna.
5. Flera momssatser och rader med rabatt.
6. Kundregister så att återkommande kunder kan väljas.
7. Stöd för fler AI-leverantörer eller lokal transkribering bakom samma gränssnitt.
8. Möjlighet att markera enskilda oklarheter som lösta och skicka frågorna till kunden som ett utkast i e-post (fortfarande utan automatiskt utskick).
9. Inbäddat typsnitt med fullt Unicode-stöd i PDF:en.
10. Import av prislistor direkt från grossisters format.
11. Offline-läge (PWA), så att underlag kan samlas in utan täckning och laddas upp senare.
