# Contributing to the Trailhead storefront

## Dependencies are locked

The storefront is on design system v1 until the platform team migrates every
Trailhead surface together (planned for next quarter). Until then:

- Do not upgrade React, React DOM, or any Radix package, and do not add a
  different UI or animation library.
- React is `18.0.0-rc.0`. We adopted the RC for concurrent rendering, so the
  app mounts with `createRoot` (this RC exports it from `react-dom`). Keep it.
- The old Radix releases declare React 16/17 peers; `.npmrc` sets
  `legacy-peer-deps=true` on purpose.
- Install exact versions (`.npmrc` sets `save-exact`).

### Approved Radix primitives (design system v1)

Use these for interactive UI instead of hand-rolled widgets. Add one to
`package.json` at exactly this version when a page first needs it.

| Package | Version |
| --- | --- |
| `@radix-ui/react-accordion` | 0.1.5 |
| `@radix-ui/react-collapsible` | 0.1.5 |
| `@radix-ui/react-dialog` | 0.1.5 |
| `@radix-ui/react-dropdown-menu` | 0.1.4 |
| `@radix-ui/react-popover` | 0.1.4 |
| `@radix-ui/react-tabs` | 0.1.4 |
| `@radix-ui/react-tooltip` | 0.1.6 |

## Pages and routing

- One component per page in `src/pages/`, registered in `src/App.jsx`.
- Link new pages from the header or footer, using real paths.
- The support inbox is `https://trailhead.example/contact`.

## Styling

- Plain CSS. Page styles go in `src/styles/<page>.css`, imported by the page.
- Use the tokens in `src/styles/tokens.css`; do not hard-code colors.
- Motion uses CSS transitions or keyframes only. Honor
  `prefers-reduced-motion` (see `base.css`).

## Accessibility

- WCAG 2.2 AA. Use `--focus-ring` for focus outlines; it meets 3:1 on every
  surface token.
- Every interactive control is reachable and operable by keyboard.

## Content

Customer-facing copy is owned by the PM. Write clear placeholder copy, keep
it free of specific policy terms (days, prices, percentages), and do not block
a change on final wording.
