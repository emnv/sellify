# Sellify platform brand guideline

**Applies to:** the Sellify backend that shop owners log into, including the Online Store settings
screens. **Does not apply to:** the public stores that shops publish (each store has its own
brand, set in the store editor).

**Source:** the [sellify.market](https://www.sellify.market) logo, colours and type, adapted for a
dense, accessible work tool.

**In code:** tokens in `src/app/globals.css` and components in `src/components/ui/`. This document
explains them. If the two disagree, the code is right and this document must be fixed.

---

## 1. Colours

Tailwind's default palette is switched off. Only the tokens below exist, as utilities
(`bg-primary`, `text-fg-muted`, `border-border`, …).

### Brand and action

| Token | Hex | Use |
|---|---|---|
| `brand` | `#9333EA` | Logo purple. Logo, highlights. |
| `brand-strong` | `#7C3AED` | Text on `brand-soft` (active nav item, selected pill). |
| `brand-soft` | `#F3E8FF` | Background of the active nav item and selected filter pill. |
| `primary` | `#0F766E` | **Primary buttons, links.** One per page or form. |
| `primary-hover` | `#115E59` | Hover on primary. |
| `primary-soft` | `#CCFBF1` | Subtle teal backgrounds. |
| `accent` | `#14B8A6` | Sellify teal: focus rings, button glow. **Never for text or fills behind text.** |

> **Why two teals?** sellify.market uses `#14B8A6` for its buttons, but white text on it has a
> contrast ratio of 2.5:1, which fails WCAG AA. The backend is a daily work tool, so buttons use
> the darker teal from the same family (`#0F766E`, 5.5:1) and keep the Sellify glow
> (`shadow-primary`). The bright teal stays for focus rings and accents.

### Surfaces and text

| Token | Hex | Use |
|---|---|---|
| `canvas` | `#F9FAFB` | Page background. |
| `surface` | `#FFFFFF` | Cards, sidebar, inputs, modals. |
| `surface-muted` | `#F3F4F6` | Table header, hover rows, image placeholders. |
| `border` | `#E5E7EB` | Card borders, dividers. |
| `border-strong` | `#D1D5DB` | Input borders, secondary button border. |
| `fg` | `#111827` | Body text, headings. |
| `fg-muted` | `#4B5563` | Descriptions, secondary text. |
| `fg-subtle` | `#6B7280` | Hints, table headers, meta text (4.8:1 on white). |
| `fg-inverse` | `#FFFFFF` | Text on primary and danger buttons. |

### Status

Always used as a pair: `-fg` text on `-bg` background (all pass WCAG AA).

| Status | Text | Background | Use |
|---|---|---|---|
| Success | `#15803D` | `#DCFCE7` | Paid, Shown online, Saved |
| Warning | `#B45309` | `#FEF3C7` | Low stock, Pending, In progress |
| Danger / error | `#B91C1C` | `#FEE2E2` | Sold out, Cancelled, form errors |
| Info | `#1D4ED8` | `#DBEAFE` | Booked, Ready, neutral notices |
| Neutral | `#374151` | `#F3F4F6` | Hidden, Collected, inactive |

`danger` (`#DC2626`) is also the fill of destructive buttons.

---

## 2. Typography

| Role | Font | Size / line | Weight | Class |
|---|---|---|---|---|
| Page title | Plus Jakarta Sans | 24 / 32px | Bold | `font-heading text-title font-bold` |
| Section heading (card title) | Plus Jakarta Sans | 18 / 28px | Semibold | `font-heading text-heading font-semibold` |
| Body, inputs, buttons | Roboto | 14 / 20px | Regular, labels Medium | `text-body` |
| Small print (hints, badges, meta) | Roboto | 12 / 16px | Regular or Medium | `text-small` |

Only these four sizes exist. Headings are sentence case ("Repair prices", not "Repair Prices").
Numbers in tables are right-aligned with tabular figures.

---

## 3. Spacing, corners, shadows

- **Spacing:** 4px base unit. Use `1` (4px), `2` (8), `3` (12), `4` (16), `5` (20), `6` (24), `8` (32).
  - Inside cards: 20px (`p-5`).
  - Between cards and sections: 24px (`gap-6`).
  - Between form fields: 16px.
  - Between label and input: 6px.
- **Corners:**

  | Size | Radius | Used for |
  |---|---|---|
  | `sm` | 6px | Tags, checkboxes |
  | `md` | 8px | Inputs, small buttons |
  | `lg` | 12px | Buttons, cards, modals |
  | `full` | 9999px | Filter pills, status badges, switches |

- **Shadows:**

  | Shadow | Used for |
  |---|---|
  | `shadow-card` | Cards, very subtle |
  | `shadow-primary` | Teal glow under primary buttons, as on sellify.market |
  | `shadow-popover` | Modals, mobile menu |

  Nothing else casts a shadow.

---

## 4. Layout

- **Sidebar:** 240px, white, fixed on desktop (≥ 1024px). On smaller screens it becomes a top
  bar with a menu button that opens a drawer.
- **Content width:** 1200px maximum. Page padding is 16px on mobile, 24px on tablet and 32px on
  desktop.
- **A standard page, top to bottom:**
  1. **PageHeader:** title, one-line description, actions on the right (at most one primary
     button). Detail pages add a "← Parent" back link.
  2. **Notices**, if any: success after save, errors.
  3. **Card** with **FilterBar** (search, then pill groups), then **Table**, then **TableFooter**
     (counts).
- **Forms:** one Card per topic ("Details", "Price and stock"). Fields stack; two short fields
  can share a row (`FormRow`). Actions go bottom right: secondary (Cancel) first, primary last.
- **Detail pages:** cards in a `Grid` (2 columns on desktop), `DetailList` for label/value pairs.
- **Empty lists:** `EmptyState` with one sentence and the primary action.

---

## 5. Components

Every backend page uses these and nothing else. They have fixed variants and sizes, and accept no
colour or size overrides.

| Component | Variants / sizes | Notes |
|---|---|---|
| `Button` | primary · secondary · ghost · danger; sm (32px) · md (40px) | `href` renders a link styled as a button. `loading` shows a spinner. |
| `SubmitButton` | same as Button | Shows a spinner while its form's action runs. |
| `Pill` | one size (32px), selected / not | Filter pills. Selected = brand-soft. |
| `Tag` | one style | Neutral property label (category, storage). |
| `StatusBadge` | success · warning · danger · info · neutral · brand | Always includes a word, never colour alone. |
| `FilterBar`, `FilterSearch`, `FilterPills` | — | Filters live in the URL. |
| `Field` + `Input` / `Textarea` / `Select` | one size (40px) | Field owns the label, hint and error. Errors turn the border red. |
| `Switch`, `Checkbox` | — | Switch for on/off settings, Checkbox for choices in a list. |
| `Table`, `THead`, `TBody`, `Tr`, `Th`, `Td`, `TableEmpty`, `TableFooter` | — | Inside `Card padding="none"`. |
| `Card` | padding md / none | Optional title, description, actions. |
| `Modal` | — | Native dialog: Esc closes it and focus is trapped. |
| `PageHeader`, `Page`, `Grid`, `DetailList` | — | Page structure. |
| `Notice`, `EmptyState`, `Skeleton` | Notice: success · warning · danger · info | Feedback and loading. |

---

## 6. Logo

- **Lockup:** the purple "S" mark (`/public/brand/sellify-logo.png`) followed by "Sellify" in
  Plus Jakarta Sans Bold, `fg` colour. Use the `Logo` component.
- Use the mark alone only where the wordmark doesn't fit (favicon, very narrow bars).
- Keep the logo on white or `canvas`. Don't recolour, stretch, add effects or place it on photos.
- Minimum height: 20px for the mark.

---

## 7. Tone of voice

Shop owners are busy and often on a phone between customers. Write like a helpful colleague.

- **Buttons** are a verb plus an object: "Add product", "Save changes", "Book repair",
  "Record sale". Never "Submit", "OK" or "Click here".
- **Destructive actions** name what is lost: "Delete product". Their confirm dialog says what
  happens and offers a safe way out: "Keep product".
- **Success:** short, past tense. "Product saved." "Sale recorded."
- **Errors:** say what happened and what to do, without blame or codes. "Enter a price like 129
  or 129.99." "Could not save the product. Try again."
- **Empty states:** say what goes here and why it matters, then give the action. "No products yet.
  Add your phones, accessories and parts…"
- Plain words: "online store", not "storefront instance". Use € amounts with two decimals, and
  dates like "Thu 12 Jun, 14:00".
- Sentence case everywhere. No exclamation marks in system messages.

---

## 8. How this is enforced

1. **Tokens only.** Default Tailwind colours, sizes, radii and shadows are removed, so off-brand
   classes produce no style.
2. **Lint.** In `src/app/(backend)/**` and `src/app/(auth)/**`, ESLint errors on:
   - raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<table>` and `<dialog>`
   - hex colours, Tailwind default palette classes, arbitrary values like `p-[13px]`, and inline
     `style`
3. **Components don't accept `className` or `style`**, so one page can't drift.
4. **`CLAUDE.md`** tells AI coding tools to follow all of this.
