# Narada design system

## Purpose

Narada has two related interfaces:

- a customer ordering experience designed for quick, one-handed mobile use;
- a staff console designed for fast scanning and repeated actions during service.

The design system preserves those workflows and the existing visual identity while
standardizing generic controls on locally owned shadcn components. shadcn is the
primitive layer, not the product design: Narada-specific components remain custom
compositions.

## Design principles

1. **The next action is obvious.** Each surface has one visually dominant action.
2. **Service speed beats decoration.** Controls are large, labels are direct, and
   status changes are visible without opening another screen.
3. **Role color carries meaning.** Kitchen, floor, counter, and admin tones identify
   work context; they are not decorative themes.
4. **Customer ordering stays tactile.** Food, cart, voice, games, and stories retain
   their expressive layouts rather than becoming generic dashboard cards.
5. **Accessibility is part of the component contract.** Keyboard focus, names,
   dialog focus management, reduced motion, and 44px touch targets are defaults.

## Visual foundations

### Typography

| Token          | Typeface          | Use                                  |
| -------------- | ----------------- | ------------------------------------ |
| `font-sans`    | Inter Variable    | controls, body copy, labels, data    |
| `font-display` | Fraunces Variable | outlet identity, page titles, totals |

- Body text defaults to 14px on operational screens and 16px on customer inputs.
- Page titles use Fraunces sparingly; action labels and status text stay in Inter.
- Use sentence case. Avoid tracked uppercase except compact operational status labels.

### Color

The source of truth is `apps/web/src/index.css`. Components consume semantic
tokens; pages must not choose raw palette colors for reusable interaction states.

| Semantic role                        | Current visual intent                   |
| ------------------------------------ | --------------------------------------- |
| `background` / `foreground`          | warm neutral canvas and near-black text |
| `card` / `card-foreground`           | white working surface and readable text |
| `primary` / `primary-foreground`     | Narada rose action and white text       |
| `secondary` / `secondary-foreground` | quiet neutral action                    |
| `muted` / `muted-foreground`         | supporting surfaces and copy            |
| `destructive`                        | irreversible or failed action           |
| `success`                            | paid, served, completed, available      |
| `warning`                            | waiting, attention, ready               |
| `info`                               | neutral live state or preparation state |
| `ring`                               | visible keyboard focus                  |

Staff role accents remain scoped through `--tone`, `--tone-ink`, `--tone-tint`,
and `--tone-soft`. A tone may decorate a panel or status marker, but must not replace
semantic destructive, warning, or success meaning.

### Shape and elevation

- Controls: `rounded-lg`.
- Cards and operational panels: `rounded-xl`.
- Focused mobile sheets and customer feature surfaces: `rounded-2xl` or
  `rounded-3xl` when the larger silhouette is already part of the experience.
- Prefer borders and surface contrast. Reserve shadows for overlays and raised
  customer actions.
- Do not add hover lift to every card. Motion should explain an interaction.

### Spacing and layout

- Use `gap-*` for sibling spacing.
- Use `size-*` when width and height are equal.
- Keep customer content within the existing mobile reading width.
- Keep staff pages dense enough to scan, with a responsive rail on larger screens
  and a horizontal role-aware navigator on mobile.
- `className` on shadcn components is for layout. Visual variants belong in the
  primitive or its CVA variants.

## Component architecture

### Layer 1: shadcn primitives

Generic interaction and accessibility live in `apps/web/src/components/ui`.
Components are added or updated with the shadcn CLI using the existing Radix Nova,
Tailwind v4, CSS-variable, and Lucide configuration.

Required primitive set:

- `button`, `input`, `input-group`, `field`, `textarea`;
- `select`, `native-select`, `checkbox`, `switch`, `toggle-group`;
- `card`, `badge`, `separator`, `skeleton`, `empty`, `spinner`, `alert`;
- `dialog`, `alert-dialog`, `sheet`, `drawer`, `collapsible`;
- `sidebar` only after the operational surfaces are stable;
- `sonner` only when replacing the existing toast host.

Every addition must be previewed before writing:

```sh
pnpm dlx shadcn@latest add <component> --dry-run
pnpm dlx shadcn@latest add <component> --diff <file>
```

Do not use `--overwrite` without reviewing and merging local changes.

### Layer 2: Narada compositions

Product components remain in `apps/web/src/components` and compose Layer 1:

- `Panel` and `Metric` compose `Card` and `Badge` while retaining role tones.
- `CustomerPhoneField` composes `Field`, `InputGroup`, and `Input`.
- `Dialogs` exposes Narada's promise-based workflow while rendering shadcn
  `Dialog`, `AlertDialog`, and field primitives internally.
- `TableSheet` composes `Sheet` on desktop/tablet and `Drawer` on mobile.
- `Collapsible` delegates disclosure behavior to the shadcn primitive.
- `AdminShell` remains a product component; it may compose `Sidebar` after the
  controls and content surfaces are migrated.

### Layer 3: screens and experiences

Routes and feature components use Narada compositions or Layer 1 primitives.
They own workflow and layout, not reusable control styling.

The customer order experience (`OrderExperience`, menu, cart, voice, games, and
stories) remains purpose-built. Migrate only its generic buttons, overlays, fields,
badges, and loading/empty states; do not flatten it into generic cards.

## Primitive usage rules

| Current pattern                    | Target                                            |
| ---------------------------------- | ------------------------------------------------- |
| styled `<button>`                  | `Button` with an existing or named Narada variant |
| styled `<input>` / `<textarea>`    | `Field` plus `Input` / `Textarea`                 |
| adjoining phone or search controls | `InputGroup`                                      |
| simple native dropdown             | `NativeSelect`                                    |
| rich dropdown                      | `Select` with `SelectGroup` and `SelectItem`      |
| raw checkbox                       | `Checkbox` inside `Field` or `FieldSet`           |
| pills with manual selected state   | `ToggleGroup`                                     |
| styled status span                 | `Badge` with semantic variant                     |
| raw divider border                 | `Separator` when it is a content divider          |
| custom loading block               | `Skeleton` or `Spinner`                           |
| custom empty message               | `Empty`                                           |
| destructive confirmation           | `AlertDialog`                                     |
| focused form prompt                | `Dialog`                                          |
| side/bottom overlay                | `Sheet` or `Drawer`                               |
| manual expand/collapse state       | shadcn `Collapsible`                              |
| custom toast markup                | `sonner` through the existing `ask.toast` facade  |

Raw HTML remains valid for semantic layout and for controls whose native behavior is
the design. It must not duplicate a reusable styled primitive.

## Component states

Every interactive primitive supports:

- default, hover, active, focus-visible, disabled, pending, and invalid states;
- `aria-invalid` on invalid controls and `data-invalid` on their `Field`;
- a visible label or accessible name;
- a minimum 44px customer touch target and an appropriate dense staff variant;
- reduced-motion behavior for nonessential animation.

Loading buttons compose `Spinner`; they do not receive custom `isLoading` props.
Icons come from Lucide, are passed as components rather than string keys, and use
`data-icon` inside buttons.

## Governance

- `DESIGN.md` owns durable design decisions and component contracts.
- `SHADCN-MIGRATION-PLAN.md` owns implementation sequencing and task status.
- Add or update primitives through the shadcn CLI and review generated diffs.
- Prefer an existing primitive or variant before creating another component.
- Repeated visual behavior belongs in a semantic token or CVA variant, not a page.
- Product-specific workflows remain custom compositions with focused tests.
- Changes to tokens or primitive behavior require browser verification on both a
  customer surface and a staff surface.

## Explicit non-goals

- Replacing Narada with a stock shadcn dashboard aesthetic.
- Rewriting business logic during the component migration.
- Applying a new preset over locally customized components.
- Converting every semantic `div`, `section`, or product-specific layout into a
  shadcn component.
- Migrating the entire application in one unreviewable change.
