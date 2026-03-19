# auction-frontend

Next.js 14 frontend for the Auction Engine — buyer portal and vendor portal in one codebase.

## Getting Started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint (zero warnings enforced) |
| `npm run check:ui-guardrails` | Check for UI consistency violations (see below) |

---

## UI Consistency Checks

Run before every PR:

```bash
npm run check:ui-guardrails
```

This script enforces the rules in [`docs/ui-guardrails.md`](docs/ui-guardrails.md). It will
fail with exit code 1 if any of the following are detected:

- **`variant="primary"`** anywhere in app/component code — use `"default"` instead
- **`<Button variant="danger">`** — use `"destructive"` for buttons; `"danger"` is Badge-only
- **`from '@/components/ui/Input'` in feature code** — use `FormInput` or a shadcn form widget
- **`from '@/components/ui/dialog'` in feature code** — use `<Modal>` which wraps the dialog primitive
- **Stale purple `rgba()` values** — `rgba(168,85,247,*)` or `rgba(124,92,252,*)` from the old design system
- **`<button>` nested inside `<Link>`** — style the `<Link>` directly instead
- **Hardcoded hex in `className` strings** — use design-system tokens (`bg-bg-card`, `text-text-primary`, etc.)

Full rules, checklists, and forbidden patterns: [`docs/ui-guardrails.md`](docs/ui-guardrails.md)

---

## Stack

- **Framework:** Next.js 14, App Router, TypeScript strict mode
- **Styling:** TailwindCSS v4, shadcn base-nova (`@base-ui/react` primitives)
- **Auth:** Supabase Auth (data fetching via `auction-backend` only — never Supabase direct)
- **Real-time:** Socket.IO client singleton (`lib/socket.ts`)
- **AI:** Four LangGraph agents surfaced through buyer portal

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Project architecture](/ARCHITECTURE.md)
- [UI Guardrails](docs/ui-guardrails.md)
