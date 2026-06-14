# Agent Guidance for testmind-ai

## Project overview
- React + TypeScript + Vite app.
- Tailwind CSS via `@tailwindcss/vite`.
- No backend code in this repo.
- Primary app logic in `src/App.tsx`.
- Entry points: `src/main.tsx`, `src/App.tsx`.

## Build / dev commands
- `npm run dev` → start Vite dev server
- `npm run build` → compile TypeScript and build with Vite
- `npm run lint` → run ESLint on source files
- `npm run preview` → preview production build

## Key conventions
- Keep source files under `src/`.
- Use `tsx` for components and UI.
- Tailwind utility classes appear inline in JSX.
- ESLint config is in `eslint.config.js` using TypeScript + React hooks.
- Project uses `type: module`; imports must follow ESM.

## When editing
- Preserve `package.json` scripts and dependency shape unless change is necessary.
- Avoid adding runtime frameworks beyond React, Vite, Tailwind, and tooling already present.
- Do not assume tests exist unless added explicitly.
- Use existing Vite/Tailwind integration, do not introduce nonstandard build setup.

## Useful files
- `package.json` — scripts and dependencies
- `vite.config.ts` — Vite plugin setup
- `eslint.config.js` — lint rules
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` — TypeScript config
- `src/App.tsx` — main UI and app state
- `public/` — static assets
