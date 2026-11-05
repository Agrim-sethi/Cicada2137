# Cicada2137 · Sanawar Treasure Hunt

A small Vite + TypeScript treasure-hunt page based on the supplied
`sanawar_treasure_hunt_v2.html`.

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

Vite writes the production site to `dist/`. The included `vercel.json`
configures Vercel to run the build and publish that folder.

## Set the chit passcodes

Open `src/main.ts` and edit the `PASSCODES` array near the top:

```ts
const PASSCODES: readonly string[] = ["00", "00", "00"];
```

Replace the three temporary `00` values with the actual codes printed on
the three campus chits. The passcodes are currently placeholders carried
over from the supplied HTML.

Unlocked progress is saved in the browser's local storage. The Review
puzzles button returns to Puzzle 1 without erasing unlocked progress.
