# Contributing to TestMind AI

Thank you for helping improve TestMind AI. Keep contributions focused, secure, and easy to review.

## Development workflow

1. Fork or clone the repository and create a branch from `main`.
2. Install root and backend dependencies with `npm install` and `npm install --prefix server`.
3. Copy `server/.env.example` to `server/.env` and add local credentials.
4. Make a focused change with no secrets, recordings, generated output, or unrelated formatting.
5. Run `npm run check` before opening a pull request.

## Pull requests

Describe what changed, why it changed, user impact, and validation performed. Include screenshots for interface work and explain any database or environment changes.

## Security

Do not open public issues for vulnerabilities or include working secrets in examples. Follow `SECURITY.md` for private reporting.

## Style

- Use TypeScript for application code.
- Keep source code under `src/` or `server/src/`.
- Prefer small reusable functions and explicit types.
- Preserve the existing React, Vite, Express, PostgreSQL, and Tailwind architecture.
- Add or update tests for behavior that can be exercised automatically.
