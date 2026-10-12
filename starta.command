#!/bin/bash
# Startar appen på Mac: dubbelklicka på filen (första gången: högerklicka > Öppna).
cd "$(dirname "$0")" || exit 1

echo ""
echo "  Offert från platsbesöket – startar..."
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "  FEL: Node.js saknas. Installera från https://nodejs.org (knappen LTS) och försök igen."
  read -r -p "  Tryck Enter för att stänga."
  exit 1
fi

fel() {
  echo ""
  echo "  NÅGOT GICK FEL. Ta en skärmdump av det här fönstret och skicka den till Claude."
  read -r -p "  Tryck Enter för att stänga."
  exit 1
}

if [ ! -d node_modules ]; then
  echo "  [1/3] Installerar appen. Första gången tar det några minuter..."
  npm install || fel
fi

[ -f .env ] || cp .env.example .env

if [ ! -f prisma/dev.db ]; then
  echo "  [2/3] Skapar databasen med exempeldata..."
  npm run db:setup || fel
fi

echo ""
echo "  [3/3] Startar appen. Webbläsaren öppnas automatiskt om en liten stund."
echo "  STÄNG INTE DET HÄR FÖNSTRET medan du använder appen."
echo ""
(sleep 12; open http://localhost:3000) &
npm run dev
