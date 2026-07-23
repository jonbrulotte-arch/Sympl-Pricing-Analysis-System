# Sympl Design System — Replication Guide

A single-file guide to reproduce the look, feel, and front-end architecture of
**Sympl PM** in a new sibling app (e.g. **Sympl PAS – Pricing Analysis System**).
Everything here is extracted from the live Sympl PM codebase so the two tools
feel like one product family.

> Give this file to whoever (or whatever) scaffolds Sympl PAS. Following it
> produces a visually identical shell before you write a single feature.

---

## 1. The stack (match these exactly)

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) | React 19. Server components by default. |
| Styling | **Tailwind CSS v4** | CSS-first config via `@import "tailwindcss"` — **no `tailwind.config.js`**. |
| Font | **Geist** (`next/font/google`) | Loaded as a CSS variable `--font-geist`. |
| Icons | **lucide-react** | The only icon set. Never mix icon libraries. |
| UI primitives | **Radix UI** + **class-variance-authority (cva)** | Headless behavior, styled with Tailwind. |
| Class merging | **clsx** + **tailwind-merge** via a `cn()` helper | Every component composes classes through `cn()`. |
| Tables/grids | **@tanstack/react-table v8** | The data-grid backbone. |
| Forms | **react-hook-form** + **zod** + `@hookform/resolvers` | Zod is the single source of validation truth. |
| Data/DB | **Prisma 7** (driver-adapter mode, `@prisma/adapter-pg`) + Postgres | PrismaClient must be built with an adapter. |
| Auth | **NextAuth v5** (JWT strategy) | Role stored in the JWT. |

Install the front-end essentials:

```bash
npm i clsx tailwind-merge class-variance-authority lucide-react \
      @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
      @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-tooltip \
      @radix-ui/react-switch @radix-ui/react-popover @radix-ui/react-checkbox \
      @tanstack/react-table react-hook-form zod @hookform/resolvers
npm i -D tailwindcss @tailwindcss/postcss
```

---

## 2. Design philosophy (the "feel")

Six rules that produce the Sympl look. When in doubt, follow these:

1. **Light canvas, dark rail.** The app is a light, near-white workspace with a
   single dark vertical navigation rail. That contrast is the signature.
2. **Blue is the only brand accent.** `blue-600` for primary actions and active
   state. Everything else is neutral gray until a color *means* something.
3. **Color carries meaning, not decoration.** Green = good/approved,
   yellow/amber = warning/changed, red = destructive/fail, purple = special
   status. A colored pill always encodes state.
4. **Soft rectangles.** `rounded-lg`/`rounded-md` corners, hairline
   `border-gray-200` borders, and a whisper of `shadow-sm`. No heavy shadows,
   no hard black borders.
5. **Dense but breathable.** Small text (`text-sm`/`text-xs`), tight control
   heights (`h-9`), generous card padding (`p-6`). Data-dense screens stay
   readable.
6. **Everything is a token, composed through `cn()`.** No inline hex, no
   one-off styles. Reuse the primitives below.

---

## 3. Color system

### Neutrals (the workspace)
| Token | Use |
|---|---|
| `bg-gray-50` | App background (the main content area) |
| `bg-white` | Cards, tables, inputs, popovers, top surfaces |
| `bg-gray-900` | Sidebar / dark rail |
| `border-gray-200` | Default hairline borders (cards, table cells) |
| `border-gray-300` | Input & button-outline borders |
| `text-gray-900` | Primary text |
| `text-gray-700` | Body / secondary text, ghost buttons |
| `text-gray-500` | Descriptions, muted labels |
| `text-gray-400` | Placeholders, disabled hints, empty "—" |

### Brand & semantic
| Meaning | Solid (buttons/active) | Soft pill (`bg` + `text`) |
|---|---|---|
| **Primary / brand** | `bg-blue-600` → `hover:bg-blue-700` | `bg-blue-100 text-blue-800` |
| **Success / approved** | `bg-green-500/600` | `bg-green-100 text-green-800` |
| **Warning / changed** | — | `bg-yellow-100 text-yellow-800` |
| **Destructive / fail** | `bg-red-600` → `hover:bg-red-700` | `bg-red-100 text-red-800` |
| **Special status** | — | `bg-purple-100 text-purple-800` |
| **EAV / custom-attribute accent** | — | `bg-amber-50` cells, `text-amber-800/900` |

> **Signature detail:** custom (EAV) attribute columns/values are tinted
> **amber** (`bg-amber-50`, `text-amber-900`) to visually separate "your custom
> data" from core fields. Reuse this idea in PAS for any user-defined dimension.

### Focus & rings
Interactive focus is always a **2px blue ring**:
`focus:outline-none focus:ring-2 focus:ring-blue-500`. Containers that wrap an
input use `focus-within:ring-2 focus-within:ring-blue-500`.

---

## 4. Typography

- **Family:** Geist, loaded once in the root layout as `--font-geist`, applied
  with `font-sans`. Fallback `Arial, Helvetica, sans-serif`.
- **Scale (almost everything is small):**
  | Element | Classes |
  |---|---|
  | Page title | `text-xl font-bold text-gray-900` |
  | Card / section title | `text-base font-semibold text-gray-900 tracking-tight` |
  | Body | `text-sm text-gray-700` |
  | Labels / meta / pills | `text-xs` (often `font-medium`/`font-semibold`) |
  | Section eyebrow | `text-xs font-semibold uppercase tracking-wider text-gray-500` |
- **Mono** (codes, keys, IDs): `font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded`.

---

## 5. Shape, spacing, elevation

- **Radius:** cards/containers `rounded-lg` (or `rounded-xl` for popovers),
  controls/buttons `rounded-md`, pills `rounded-full`.
- **Shadow:** `shadow-sm` for cards; `shadow-xl` only for floating layers
  (dropdowns, menus, modals). Avoid anything heavier.
- **Padding rhythm:** cards `p-6`; toolbars/rows `px-3 py-2`; page shells `p-6`.
- **Control height:** default `h-9`; small `h-8`. Keep them consistent so
  toolbars align.

---

## 6. Config & bootstrap files (copy verbatim)

### `postcss.config.mjs`
```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

### `src/app/globals.css`
```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}
```

### `src/app/layout.tsx` (root)
```tsx
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Sympl PAS",
  description: "Pricing Analysis System",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="h-full font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### `src/lib/utils.ts` (the `cn()` helper — used everywhere)
```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## 7. Layout architecture

The frame is a **flex row**: a fixed dark sidebar + a scrollable light main area.

### App shell
```tsx
// src/components/layout/app-shell.tsx
<div className="flex h-screen overflow-hidden bg-gray-50">
  <Sidebar user={user} grantedPermissions={grantedPermissions} />
  <main className="flex-1 overflow-y-auto">{children}</main>
</div>
```

### Sidebar (the dark rail) — key characteristics
- `bg-gray-900 text-white`, `w-56` expanded / `w-16` collapsed, full height,
  `transition-all duration-200`.
- **Brand wordmark:** `Sympl <span className="text-blue-400">PAS</span>` —
  white word + **blue-400** accent on the sub-name. (In PM it's "PM"; keep the
  exact pattern, swap the suffix.)
- **Nav item (default):** `text-gray-300 hover:bg-gray-800 hover:text-white`,
  `rounded-lg px-2 py-2 text-sm font-medium`, icon `h-5 w-5`.
- **Nav item (active):** `bg-blue-600 text-white` (match via
  `pathname.startsWith(href)`).
- **Section grouping:** an `Admin` eyebrow (`text-xs uppercase tracking-wider
  text-gray-500`) separates admin links from primary nav.
- **Footer:** avatar circle (`bg-blue-500`, initials), name + role, and small
  icon buttons for inbox (with a red unread badge), profile, and sign-out.
- **Collapse toggle** pinned at the bottom.

### Page container
Every page opens with `p-6`. Constrain reading-width content with
`max-w-2xl`/`max-w-4xl`; let data grids go full-bleed.

---

## 8. Core components (drop-in)

### Button — `src/components/ui/button.tsx`
cva-based, six variants, four sizes.
```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-blue-600 text-white hover:bg-blue-700",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        outline: "border border-gray-300 bg-white hover:bg-gray-50 text-gray-700",
        secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
        ghost: "hover:bg-gray-100 text-gray-700",
        link: "text-blue-600 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);
```
Wrap in a `forwardRef` that supports Radix `asChild` via `@radix-ui/react-slot`.

### Card — `src/components/ui/card.tsx`
```tsx
// Card
"rounded-lg border border-gray-200 bg-white shadow-sm"
// CardHeader   "flex flex-col space-y-1.5 p-6"
// CardTitle    "text-base font-semibold leading-none tracking-tight text-gray-900"
// CardDescription "text-sm text-gray-500"
// CardContent  "p-6 pt-0"
// CardFooter   "flex items-center p-6 pt-0"
```

### Badge — `src/components/ui/badge.tsx`
The status-pill vocabulary. `rounded-full px-2.5 py-0.5 text-xs font-semibold`.
```tsx
variant: {
  default:     "bg-blue-100 text-blue-800",
  secondary:   "bg-gray-100 text-gray-800",
  destructive: "bg-red-100 text-red-800",
  outline:     "border border-gray-200 text-gray-700",
  success:     "bg-green-100 text-green-800",
  warning:     "bg-yellow-100 text-yellow-800",
  purple:      "bg-purple-100 text-purple-800",
}
```

### Input — `src/components/ui/input.tsx`
```tsx
"flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
```

---

## 9. Recurring UI patterns

- **Tab bar** (in-page navigation, as on the project detail screen): a
  horizontal row of buttons; active tab = `text-blue-600` + a blue underline;
  inactive = `text-gray-500 hover:text-gray-700`. Icons from lucide at
  `h-3.5 w-3.5`.
- **Data grid:** `@tanstack/react-table` with a `<colgroup>` driving fixed
  widths, sticky header (`sticky top-0 bg-gray-50`), hairline
  `border-gray-100` cell borders, inline-edit cells, and pinned/frozen columns
  via TanStack's split left/center header groups. Custom columns tinted amber.
- **Floating layers** (dropdowns, mention popovers, menus): `bg-white border
  border-gray-200 rounded-xl shadow-xl`, `z-40`, and mind open-direction so
  they aren't clipped by sticky bars.
- **Empty state:** centered muted text, an em dash `—` for empty cells
  (`text-gray-300 italic text-xs`).
- **Toolbars:** `flex items-center justify-between gap-3 p-3 border-b
  border-gray-200 bg-white` with a left search input and right-aligned actions.
- **Avatars:** initials on `bg-blue-500`/`bg-blue-100` circles, sizes
  `h-8 w-8` (list) or larger for headers.
- **Dates:** format with a shared `formatDate` (`toLocaleDateString("en-US",
  { year:"numeric", month:"short", day:"numeric" })`) → "Jul 7, 2026".

---

## 10. Bootstrap checklist for Sympl PAS

1. `npx create-next-app@latest` (App Router, TypeScript, Tailwind).
2. Confirm **Tailwind v4** — delete any `tailwind.config.js`; use the
   `globals.css` and `postcss.config.mjs` above.
3. Add Geist in the root layout; set the `<title>`/wordmark to **Sympl PAS**.
4. Create `src/lib/utils.ts` with `cn()`.
5. Drop in the four primitives: `button`, `card`, `badge`, `input`.
6. Build the **app shell** (dark `bg-gray-900` sidebar + `bg-gray-50` main).
   Wordmark = `Sympl <span class="text-blue-400">PAS</span>`.
7. Reuse the color/typography tokens from §3–§4 for every new screen.
8. For any pricing tables, use `@tanstack/react-table` with the grid pattern in
   §9 so PAS's data views match PM's grid muscle-memory.
9. Keep the semantics: blue = action, green = good, amber/yellow = attention,
   red = danger, purple = special, amber-tint = user-defined data.

Do these nine and PAS will look like it shipped from the same team on day one.

---

*Generated from the Sympl PM codebase as a design reference. No PM code was
modified. Adapt freely for Sympl PAS.*
