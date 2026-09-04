# shadcn migration plan

## Objective

Implement the Narada design system defined in [`DESIGN.md`](DESIGN.md) across the
web application without changing business logic, routes, API payloads, permissions,
or the recognizable customer and staff workflows.

## Constraints

- Package manager: pnpm.
- Project: Vite, React 19, Tailwind CSS v4, Radix Nova, CSS variables, Lucide.
- Existing shadcn primitives: `Badge`, `Button`, `Dialog`, `Input`, and `Select`.
- Never use a preset overwrite or `shadcn add --overwrite` without explicit review.
- Preview every component addition or update with `--dry-run` and `--diff`.
- Preserve active worktree changes; start a phase only when its owned files are free.
- Keep each phase independently reviewable and green before starting the next.

## Baseline audit

At the time this plan was created, application code contained approximately:

- 119 raw buttons;
- 24 raw inputs;
- 8 raw selects;
- 2 raw textareas;
- 10 shadcn `Button` uses and 19 shadcn `Input` uses;
- 8 application files importing the local shadcn primitive layer.

These counts are migration signals, not acceptance targets. A native control may
remain when native behavior is deliberately part of the design.

## Execution rules

1. Work in dependency order: baseline → tokens → primitives → compositions → pages.
2. Do not combine a business-logic refactor with a component migration.
3. Preserve public component APIs when replacing internals, especially `ask`,
   `Panel`, `TableSheet`, and `AdminShell`.
4. Run focused tests during a task and the phase gate before handoff.
5. Compare mobile and desktop screenshots with the baseline after every visual task.

## Task breakdown

### T0 — capture behavioral and visual baselines

**Owns:** test/browser artifacts only; no product source.

**Work:**

- Capture mobile and desktop screenshots for authentication, customer ordering,
  admin, kitchen, waiter, floor, and counter surfaces.
- Record keyboard behavior for forms, dialogs, sheets, and staff navigation.
- Run the existing web tests before presentation changes.

**Verification:** existing web tests pass; every route in the browser matrix below
has a reference screenshot.

**Depends on:** none.

### T1 — align semantic tokens

**Owns:**

- `apps/web/src/index.css`
- token documentation in `DESIGN.md` only if implementation exposes a mismatch.

**Work:**

- Map the existing rose action, neutral surfaces, focus ring, success, warning,
  information, and destructive colors to CSS variables.
- Preserve the scoped staff role-tone variables.
- Align radius and elevation tokens with the documented hierarchy.
- Replace no page styles in this task.

**Verification:** customer and staff reference screens retain their colors,
typography, contrast, and focus visibility.

**Depends on:** T0.

### T2 — complete and normalize the primitive layer

**Owns:**

- `apps/web/src/components/ui/*`
- `apps/web/components.json`
- package metadata only when a registry component requires it.

**Work:**

1. Run `pnpm dlx shadcn@latest info --json` from `apps/web`.
2. Preview upstream diffs for installed primitives before merging changes.
3. Add the next-phase primitives only:
   - `field`, `input-group`, `textarea`, `native-select`, `checkbox`;
   - `card`, `separator`, `skeleton`, `empty`, `spinner`, `alert`;
   - `alert-dialog`, `sheet`, `drawer`, `collapsible`, `toggle-group`.
4. Add CVA variants only for repeated Narada actions and statuses.
5. Verify Radix composition, Lucide icons, group wrappers, and component exports.

**Verification:** typecheck, lint, formatting, production build, and focused primitive
render tests pass.

**Depends on:** T1.

### T3 — migrate authentication and settings forms

**Owns:**

- `apps/web/src/components/CustomerPhoneField.tsx`
- `apps/web/src/pages/CustomerLogin.tsx`
- `apps/web/src/pages/CustomerSignup.tsx`
- `apps/web/src/pages/admin/Login.tsx`
- `apps/web/src/pages/admin/Signup.tsx`
- `apps/web/src/pages/admin/Dashboard.tsx`
- their existing tests.

**Work:**

- Use `FieldGroup`, `Field`, labels, descriptions, errors, and invalid states.
- Compose country code and national number with `InputGroup` while continuing to
  send one canonical phone value.
- Replace page-specific generic control styling with primitive variants.
- Preserve validation, password limits, redirects, role scoping, and slug behavior.

**Verification:** authentication/settings tests pass; keyboard-only form submission,
error announcement, autofill attributes, and phone payloads work in the browser.

**Depends on:** T2. Do not start while customer-auth files have uncommitted work.

### T4 — migrate admin CRUD controls

**Owns:**

- `apps/web/src/pages/admin/Menu.tsx`
- `apps/web/src/pages/admin/Tables.tsx`
- `apps/web/src/pages/admin/Users.tsx`
- `apps/web/src/pages/admin/Orders.tsx`
- `apps/web/src/pages/admin/Report.tsx`
- `apps/web/src/pages/admin/Qr.tsx`
- their existing tests.

**Work:**

- Replace duplicated styled buttons, fields, textareas, selects, and checkboxes.
- Use `Card`, `Badge`, `Separator`, `Empty`, and `Skeleton` for generic states.
- Keep menu editors, table management, reports, and user management as domain
  compositions.

**Verification:** all admin CRUD tests pass; create, edit, validation, destructive
confirmation, empty, and loading states are browser-verified.

**Depends on:** T2. May run after T3 or in parallel only with disjoint ownership.

### T5 — migrate shared staff compositions

**Owns:**

- `apps/web/src/components/Panel.tsx`
- `apps/web/src/components/Collapsible.tsx`
- `apps/web/src/components/StaffOrderPad.tsx`
- `apps/web/src/components/SoldOut.tsx`
- focused component tests.

**Work:**

- Rebase panel, metric, badge, disclosure, form, and action internals on primitives.
- Preserve exported APIs, role tones, operational density, and touch targets.

**Verification:** component tests pass; role-tone rendering, disclosure keyboard
behavior, and the order-pad workflow match the baseline.

**Depends on:** T2.

### T6 — migrate operational staff pages

**Owns:**

- `apps/web/src/pages/Kitchen.tsx`
- `apps/web/src/pages/KitchenKot.tsx`
- `apps/web/src/pages/Waiter.tsx`
- `apps/web/src/pages/WaiterTable.tsx`
- `apps/web/src/pages/Floor.tsx`
- `apps/web/src/pages/Counter.tsx`
- their existing tests.

**Work:**

- Replace generic controls and status markup with migrated compositions/primitives.
- Preserve timers, live refresh, role permissions, dense scanning, and one-tap
  operational actions.

**Verification:** all staff page tests pass; each seeded role completes its primary
workflow in the browser at mobile and desktop widths.

**Depends on:** T5.

### T7 — migrate dialogs, sheets, and feedback

**Owns:**

- `apps/web/src/components/Dialogs.tsx`
- `apps/web/src/components/TableSheet.tsx`
- `apps/web/src/components/order/SpinSheet.tsx`
- related tests.

**Work:**

- Preserve the `ask` API while using `AlertDialog` for destructive confirmation,
  `Dialog` for prompts, and `sonner` behind `ask.toast`.
- Use `Sheet` or `Drawer` for table and mobile overlays.
- Remove duplicated focus trapping, Escape handling, body scroll locking, and
  overlay z-index logic only after the primitive behavior is verified.
- Give every modal surface a title and description.

**Verification:** focus enters and returns correctly; Escape/outside-click behavior,
scroll locking, accessible names, and existing callers pass.

**Depends on:** T2. Coordinate with T8 because customer overlays may share files.

### T8 — migrate customer ordering primitives

**Owns:**

- `apps/web/src/components/order/*` except files owned by T7 during overlap;
- `apps/web/src/pages/Table.tsx`;
- `apps/web/src/pages/Bill.tsx`;
- their existing tests.

**Work:**

- Migrate generic buttons, toggles, badges, fields, loading, and empty states.
- Preserve the existing menu, cart, voice, game, story, and bill layouts.
- Do not convert expressive product surfaces into generic cards.

**Verification:** takeaway and table-ordering tests pass; cart, voice, games, stories,
checkout, and print bill match the visual baseline.

**Depends on:** T2 and T7 for overlay-owned files.

### T9 — evaluate the staff shell

**Owns:**

- `apps/web/src/components/AdminShell.tsx`
- shell/navigation tests.

**Work:**

- Compare shadcn `Sidebar` with the existing desktop rail and mobile horizontal nav.
- Migrate only if it preserves role filtering, active-route clarity, mobile speed,
  print behavior, and the global call alert.
- Keeping the custom shell while composing `Button`, `Badge`, and `Separator` is an
  acceptable result.

**Verification:** every role sees only allowed navigation; active state, logout,
mobile navigation, alerts, and print behavior pass.

**Depends on:** T6.

### T10 — remove migration residue

**Owns:** web UI and CSS files identified by the audit.

**Work:**

- Remove unused helper classes, obsolete primitive wrappers, and dead imports.
- Recount raw generic controls and document intentional native exceptions.
- Run the full repository and browser gates.

**Verification:** no unused exports; no duplicate generic control styling; all gates
and the complete browser matrix pass.

**Depends on:** T3–T9.

## Phase gate

Run after every completed task group:

```sh
CI=true pnpm test
CI=true pnpm run typecheck
CI=true pnpm run lint
CI=true pnpm run format:check
CI=true pnpm run knip
CI=true pnpm --filter @narada/web build
```

## Browser matrix

- Customer auth: `/login`, `/signup`.
- Staff auth: `/outlet/:slug/login`.
- Admin: `/admin`, `/admin/menu`, `/admin/tables`, `/admin/users`,
  `/admin/orders`, `/admin/report`, `/admin/qr`.
- Staff: `/kitchen`, `/waiter`, `/floor`, `/counter`.
- Customer: takeaway, table ordering, cart, checkout/bill, voice, game, and story
  overlays.
- Viewports: mobile and desktop; keyboard-only and reduced-motion checks.

## Completion criteria

- Generic interactive controls use the local shadcn primitive layer.
- Narada domain components compose primitives without losing their product language.
- Existing routes, payloads, authorization, and workflows are unchanged.
- Reusable action and status colors use semantic tokens or named variants.
- Forms expose labels, descriptions, invalid states, and visible focus.
- Dialogs and sheets manage focus, Escape, scroll locking, and focus return.
- Intentional native-control exceptions are documented.
- Tests, typecheck, lint, formatting, knip, production build, and browser matrix pass.

## Implementation status (2026-09-04)

| Task          | Status      | Verification / constraint                                                                                                       |
| ------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| T0            | Partial     | Tests and two desktop screenshots captured; full browser matrix is blocked by unavailable API environment and viewport control. |
| T1, T2, T4–T9 | Implemented | Focused tests, typecheck, lint, and formatting run for the owned changes.                                                       |
| T3            | Implemented | Focused auth/settings tests, typecheck, lint, format, build, and desktop auth visual verification pass.                         |
| T10           | Partial     | Raw-control audit complete; the complete mobile/role browser matrix remains unavailable.                                        |

Intentional native exception: the image-upload input in `apps/web/src/pages/admin/Menu.tsx`.

Full repository test run passes serially: 96 files / 547 tests.
The admin tables endpoint now returns `outletSlug`, so relative/localhost table and QR URLs work (T4 verification).
