# UI Guardrails — auction-frontend

> Authority document for all UI decisions in this codebase.
> Phases 1–6 of the shadcn base-nova migration are complete. These rules capture the
> finalized canonical component set and enforce visual consistency going forward.
>
> **Run `npm run check:ui-guardrails` before every PR.**

---

## 1. Canonical Component Reference

### Primitive layer (`@base-ui/react`)
`@base-ui/react` is the headless primitive layer for all interactive widgets.
**Never import it directly in app code.** All base-ui primitives are wrapped inside
`components/ui/` — consume only those wrappers.

### Application primitive layer (`components/ui/`)

| Component | Import path | When to use |
|---|---|---|
| `Button` | `@/components/ui/Button` | Every interactive action. Use `variant` + `size` props. |
| `Badge` | `@/components/ui/Badge` | Status labels, tags, counts. Never a raw `<span>`. |
| `Card` | `@/components/ui/Card` | Every elevated content block. Use `interactive` prop for clickable cards. |
| `FormInput` | `@/components/ui/FormInput` | All labeled form fields (text, number, datetime-local). |
| `Input` | `@/components/ui/Input` | Internal primitive — used only by `FormInput`. Do not import in app code. |
| `Modal` | `@/components/ui/Modal` | All overlay dialogs. Never import `dialog.tsx` in pages/features. |
| `Table` / `TableRow` etc. | `@/components/ui/Table` | Data tables only. |
| `Tabs` / `TabsRoot` etc. | `@/components/ui/Tabs` | Tab navigation. Generic `Tabs<T>` for pill-style; sub-primitives for custom layouts. |
| `Tooltip` | `@/components/ui/Tooltip` | Icon-only buttons, truncated text hints. |
| `Badge` (Alert banner) | `@/components/ui/alert` | Page-level status banners (reserved/paused). |
| `Spinner` / `FullPageSpinner` | `@/components/ui/Spinner` | All loading states. |
| `EmptyState` | `@/components/ui/EmptyState` | Empty lists and zero-data pages. |

### shadcn form widgets (lowercase, from CLI)
These are CLI-installed and live at lowercase paths. Use them for form controls that
go beyond `FormInput`:

| Component | Import path | Use case |
|---|---|---|
| `Select` / `SelectTrigger` etc. | `@/components/ui/select` | Dropdown selects in forms. |
| `Switch` | `@/components/ui/switch` | Boolean toggles in forms. |
| `Textarea` | `@/components/ui/textarea` | Multi-line text inputs. |
| `Separator` | `@/components/ui/separator` | Visual dividers between sections. |
| `Skeleton` | `@/components/ui/skeleton` | Placeholder loading shimmer. |
| `Label` | `@/components/ui/label` | Standalone form labels when `FormInput` can't be used. |

---

## 2. Button Rules

### Variants — allowed values

| Variant | Use case | Never use for |
|---|---|---|
| `default` | Primary CTA — one per screen section max | Destructive actions |
| `secondary` | Secondary actions, cancel, navigation | Primary CTA |
| `ghost` | Icon-only toolbar actions, inline text links | Standalone actions |
| `destructive` | Confirm delete, force close — requires confirmation step | First-click delete |
| `outline` | Bordered non-filled action in light contexts | Dark backgrounds |

**Forbidden variants:** `"primary"`, `"danger"` — these do not exist in the Button component.
Use `"default"` for primary and `"destructive"` for danger actions.

### Sizes — allowed values
`"sm"` | `"md"` | `"lg"` | `"icon"`

### Rules
- Every interactive action uses `<Button>`. No bespoke `<button>` with manual Tailwind classes.
- **Exception:** icon-only `<button>` is permitted only when wrapped inside a `<Link>` (nav
  back-arrow) — but prefer styling the `<Link>` directly instead (see forbidden patterns §8).
- Use `loading={boolean}` prop for async actions — never disable manually and show a separate spinner.
- `<Link>` wrapping a `<Button>` is valid for navigation CTAs. Do not put `<button>` inside `<Link>`.

---

## 3. Badge Rules

### Variants — allowed values

| Variant | Semantic meaning |
|---|---|
| `default` | Neutral / default state |
| `success` | Positive outcome, accepted, live |
| `warning` | Pending, caution, needs attention |
| `danger` | Error, rejected, failed |
| `info` | Informational, draft |
| `outline` | Bordered neutral label |

**Forbidden variants:** `"primary"`, `"secondary"` — not defined in Badge.

### Sizes
`"sm"` | `"md"` (default)

---

## 4. Card Rules

- Use `<Card>` for every elevated content section.
- Pass `interactive` when the entire card is clickable.
- Never construct a card manually with `rounded-* bg-bg-card border border-border-subtle`.
  Use the `<Card>` component which encapsulates these tokens.
- **Exception:** Micro-stat cells inside a grid (e.g. 3-col metric rows) may use raw `div`s
  with design-system tokens if they are purely decorative and not interactive.

---

## 5. Form Rules

- Use `<FormInput>` for all labeled single-line fields. It handles label, hint, required mark,
  and focus styling.
- Use `<Select>` for dropdowns, `<Switch>` for toggles, `<Textarea>` for multi-line.
- **Never** use raw `<input>` or `<textarea>` inside pages or feature components — only inside
  `components/ui/` primitives themselves.
- **Never** manually write focus ring styles (`focus:shadow-[0_0_0_3px_rgba(...)]`). If a raw
  input is unavoidable, use `focus:shadow-[0_0_0_3px_rgba(59,130,246,0.20)]` (blue) — never purple.
- Validation errors: display as `<p className="text-xs text-danger">` below the field,
  or as the `hint` prop on `<FormInput>`.
- Form submit errors: display in the `<p className="text-xs text-danger bg-danger/5 border border-danger/25 rounded-lg px-4 py-2.5">` pattern.

---

## 6. Modal / Dialog Rules

- All overlay dialogs use `<Modal>` from `@/components/ui/Modal`.
- **Never** import `@/components/ui/dialog` directly in pages, layouts, or feature components.
  Only `Modal.tsx` is allowed to import it.
- `Modal` accepts: `open`, `onClose`, `title`, `description`, `size` (`sm`/`md`/`lg`/`xl`/`full`),
  `disableBackdropClose`.
- Always include a `title` for accessibility (sets `DialogTitle`).
- Modal footer pattern: `<div className="flex items-center justify-end gap-3 border-t border-border-subtle pt-3">`.

---

## 7. Tabs Rules

- Use the generic `<Tabs<T>>` component for pill-style tab bars (used in auction list, vendor
  auctions, etc.). It accepts `tabs`, `active`, `onChange`.
- Use `TabsRoot` / `TabsList` / `TabsTrigger` sub-primitives only when a custom layout is needed
  (e.g. full-bleed tab content or non-standard trigger styling).
- **Never** implement a bespoke tab bar with `border-b-2` underline buttons. Use the canonical
  `Tabs` component — it maintains consistent keyboard navigation via `@base-ui/react`.
- Badge counts: pass as the `badge` prop on each tab item — do not render a separate `<Badge>`.

---

## 8. Typography Rules

| Scale | Class pattern | Use for |
|---|---|---|
| Page title | `text-xl font-bold text-text-primary` | `<h1>` on each page |
| Section header | `text-sm font-semibold text-text-primary` | `<h2>` inside cards |
| Body | `text-sm text-text-secondary` | Paragraph content |
| Micro-label | `text-[10px] uppercase tracking-wider text-text-muted` | Stat card labels |
| Hint / muted | `text-xs text-text-muted` | Sub-labels, timestamps |
| Mono value | `font-mono text-sm font-semibold text-text-primary` | Prices, quantities, codes |

- Always use design-system text tokens (`text-text-primary`, `text-text-secondary`,
  `text-text-muted`). Never use Tailwind's built-in `text-gray-*` or `text-zinc-*`.

---

## 9. Color and Spacing Rules

### Semantic color tokens (always use these)

| Token | Use |
|---|---|
| `bg-bg-page` | Page background |
| `bg-bg-card` | Card and surface background |
| `bg-bg-elevated` | Elevated sections, input backgrounds |
| `bg-bg-modal` | Modal backgrounds |
| `bg-bg-tag` | Tag/chip backgrounds |
| `text-text-primary` | Primary body text |
| `text-text-secondary` | Secondary/subdued text |
| `text-text-muted` | Disabled, placeholder, timestamp |
| `border-border-subtle` | Subtle dividers |
| `border-border-default` | Standard input/card borders |
| `text-accent` / `bg-accent` | Brand blue — CTA highlights, active states |
| `text-success` / `text-danger` / `text-warning` | Semantic states only |

**Forbidden:** hardcoded hex (`#ffffff`, `#18181b`), `text-zinc-*`, `text-gray-*`,
Tailwind `bg-white`, `bg-black` in component JSX.

### Hover/focus shadows (blue only)
- Hover glow: `rgba(59,130,246,0.10)` — blue-500 at 10%
- Focus ring: `rgba(59,130,246,0.20)` — blue-500 at 20%
- **Forbidden:** any purple `rgba(168,85,247,*)` or `rgba(124,92,252,*)` values.

### Spacing rhythm
- Page content: `flex flex-col gap-6` or `gap-8` between major sections.
- Card internals: `gap-4` between fields, `gap-2` between list items.
- Inline icon+text pairs: `gap-1.5` or `gap-2`.

---

## 10. Dark Mode Rules

- Design-system tokens (`bg-bg-*`, `text-text-*`, `border-border-*`) automatically
  adapt via `html.dark` — no `dark:` variants needed for these.
- Semantic tokens (`text-success`, `text-danger`, `text-warning`) automatically adapt.
- `dark:` Tailwind variants are only needed when using a non-token Tailwind class
  (e.g. `dark:text-white` is a sign you should be using `text-text-primary` instead).
- Never hardcode dark-mode colors with `dark:bg-zinc-*` — use the design-system tokens.

---

## 11. Banner / Alert Rules

- Page-level status banners use `@/components/ui/alert` (shadcn CLI component):
  `<Alert>`, `<AlertTitle>`, `<AlertDescription>`.
- Variant: `"default"` (blue/info) or `"destructive"` (red/danger).
- Inline field errors: `<p className="text-xs text-danger">` only.
- Warning boxes (non-alert): use `rounded-lg border border-warning/30 bg-warning/5 p-3`.

---

## 12. Forbidden Patterns

1. **`variant="primary"`** — not a valid Button or Badge variant. Use `"default"`.
2. **`variant="danger"`** — not a valid Button or Badge variant. Use `"destructive"` (Button) or `"danger"` (Badge).
3. **`<Input>` in app pages/feature components** — raw `Input` is an internal primitive. Use `FormInput` or a shadcn form widget.
4. **`import … from '@/components/ui/dialog'` outside `Modal.tsx`** — dialog is wrapped by Modal. Feature code never imports it directly.
5. **`<button>` inside `<Link>`** — invalid HTML (interactive inside interactive). Style the `<Link>` directly with `inline-flex items-center …` classes.
6. **Purple rgba values** — `rgba(168,85,247,*)` or `rgba(124,92,252,*)` are from the old design system. All accent values must use blue.
7. **Bespoke tab bars** — `border-b-2` underline tab patterns. Use `<Tabs<T>>` or `TabsRoot` primitives.
8. **Raw `<input>` / `<textarea>` in feature code** — use `FormInput`, `Textarea` (shadcn), or `Select`.
9. **One-off inline card markup** — `rounded-lg bg-bg-card border border-border-subtle` repeated in feature code. Wrap in `<Card>`.
10. **`console.log`** in component files — use the structured logger or remove entirely.

---

## 13. New Page Checklist

Before raising a PR for a new page:

- [ ] Page `<h1>` uses `text-xl font-bold text-text-primary`
- [ ] Loading state uses `<FullPageSpinner />` or `<Spinner>`
- [ ] Empty state uses `<EmptyState>` (not a plain `<p>`)
- [ ] All elevated content sections use `<Card>`
- [ ] All actions use `<Button>` with an explicit `variant` and `size`
- [ ] No `<button>` inside `<Link>` (style the `<Link>` directly)
- [ ] No raw `<input>` or `<textarea>` — use `FormInput` / `Textarea` / `Select`
- [ ] Tab navigation uses `<Tabs<T>>` (not a bespoke border-b-2 pattern)
- [ ] Status labels use `<Badge>` with a semantic variant
- [ ] All dialogs use `<Modal>` (not a raw `<dialog>` or direct `dialog.tsx` import)
- [ ] No hardcoded hex or purple rgba values
- [ ] `tsc --noEmit` passes with zero errors
- [ ] `npm run check:ui-guardrails` passes with zero violations
- [ ] `npm run lint` passes with `--max-warnings=0`

---

## 14. New Component Checklist

Before raising a PR for a new `components/` file:

- [ ] Component lives in the right folder (`auction/`, `bid/`, `vendor/`, `agent/`, `ui/`)
- [ ] File is PascalCase (e.g. `MyWidget.tsx`)
- [ ] If it's a new `ui/` primitive: it is self-contained (does not import from a lowercase
  counterpart with the same base name — macOS filesystem collision risk)
- [ ] Props are fully typed — no `any`
- [ ] Uses design-system tokens only for colors, backgrounds, borders
- [ ] Does not reach into another feature's API or socket layer directly
- [ ] Has no inline business logic — it's purely presentational or delegates via props/callbacks

---

## 15. Accessibility Checklist

- [ ] Every interactive element is keyboard-reachable (`Tab` key cycles through)
- [ ] Icon-only buttons have an accessible label via `<Tooltip>` or `aria-label`
- [ ] Modals trap focus and restore it on close (handled by `@base-ui/react` Dialog)
- [ ] Color is never the sole communicator of meaning (always paired with text/icon)
- [ ] Text color contrast ≥ 4.5:1 against its background (WCAG AA)
- [ ] Animated elements respect `prefers-reduced-motion` where feasible
- [ ] Form fields have associated labels (via `FormInput` label prop or `<Label>`)
- [ ] Error messages are associated with their field (`aria-describedby` or proximity)

---

## 16. Responsive Checklist

- [ ] Mobile breakpoint (< 640px): single column, no horizontal overflow
- [ ] Tablet (640–1024px): 2-column grids where specified
- [ ] Desktop (> 1024px): 3–4 column grids where specified
- [ ] All tables are horizontally scrollable on narrow viewports
- [ ] Modal width bounded by `size` prop — never exceeds viewport width
- [ ] Touch targets ≥ 44×44px for all interactive elements on mobile
- [ ] No fixed-width containers that clip on small screens

---

## Appendix: macOS Filesystem Collision Rule

**Critical:** macOS uses a case-insensitive filesystem. Turbopack's module resolver is
case-sensitive. If a PascalCase file (`Tabs.tsx`) and its shadcn CLI counterpart (`tabs.tsx`)
share the same base name, the CLI-installed version will silently shadow the custom one.

**Rule:** Every PascalCase `components/ui/` primitive must be fully self-contained — it must
NOT import from a lowercase file with the same base name.

**CLI is blocked** for: `Button`, `Badge`, `Card`, `Input`, `Table`, `Tabs`, `Tooltip`.
These components already exist as self-contained PascalCase files that inline the shadcn primitives.
