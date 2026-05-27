# DSS Module Architecture And Legacy Migration Standard

This document is the principal standard for restructuring legacy DSS frontend modules into the newer module architecture.

It is written for humans and AI coding agents. When a legacy DSS module is converted into a new module, this file should be treated as the main source of truth for structure, ownership, migration order, and review.

This standard is intentionally broader than one module. `stp_suitability_v2`, `stp_priority`, and `mar_suitability_v2` are examples of the pattern, but this document describes the architecture that future modules should follow.

---

## 1. Purpose

The goal of the new module architecture is to make every DSS module:

- easy to read
- easy to change
- easy to test
- safe to migrate from legacy code
- consistent with other DSS modules
- clear about ownership of state, APIs, map logic, and UI

A migrated module is successful only when the behavior of the legacy module is preserved while the structure is improved.

The old module is a behavior reference. It is not an architecture reference.

---

## 2. Core Rules

These rules apply to every migration.

- Do not edit the working legacy module unless the task explicitly asks for that.
- Do not import legacy pages, context providers, or route-level components into the new module.
- Do not introduce React Context as the final architecture.
- Do not put raw backend endpoint strings inside UI components.
- Do not put map setup logic inside route files.
- Do not put large workflow logic inside JSX-heavy components.
- Do not create pass-through wrapper files with no real responsibility.
- Do not duplicate one piece of state across many stores.
- Do not hardcode panel sizing in many components.
- Do not copy a module standard from another module without renaming and adapting it.

The new architecture must be based on:

- root page orchestration
- typed service functions
- domain stores
- view-model hooks
- mode-specific components
- isolated map files
- module-root shared components for module-specific reuse
- `@/components/dss_common/` for genuinely reusable DSS UI

---

## 3. Migration Mindset

When migrating a legacy module, separate these two concerns:

### Behavior parity

The new module should preserve the behavior users already depend on:

- same backend calls
- same request payload meaning
- same response handling
- same map layers and layer ordering
- same analysis workflow
- same report or export flow
- same important defaults
- same confirmation and edit behavior

### Architecture improvement

The new module should not preserve legacy structure if that structure is messy:

- old Context providers should become stores
- scattered fetch calls should become service functions
- route pages should become one root orchestration page
- repeated UI should become shared components or module-root components
- huge mixed files should be split by responsibility
- map logic should live in map files

The correct result is not "old code copied into v2". The correct result is "old behavior expressed through the new architecture".

---

## 4. Target Folder Structure

Use this shape for DSS modules that have admin/user modes, map interaction, analysis, and results.

```text
<module>/
  layout.tsx
  page.tsx
  loading.tsx
  error.tsx
  MODULE_STANDARD.md
  PROGRESS.md

  config/
    mapModes.ts
    panels.config.ts
    tableColumns.tsx      optional, only when table/CSV output exists

  services/
    admin/
      <adminFlow>Api.ts
    users/
      <userOrDrainFlow>Api.ts
    common/
      <module>Types.ts
      <sharedApiHelpers>.ts
    uiModeService.ts        optional

  components/
    <ModuleSpecificSharedComponent>.tsx

  utils/
    <pureUtility>.ts

  admin/
    loading.tsx
    error.tsx
    components/
    hooks/
    stores/

  users/
    loading.tsx
    error.tsx
    components/
    hooks/
    stores/
```

Rules:

- `page.tsx` is the only route page that composes admin and user modes.
- Avoid `admin/page.tsx` and `users/page.tsx` when modes are switched in-page.
- `components/` at the module root is for module-specific components shared by admin and user.
- `utils/` is for pure functions only.
- `services/` owns backend communication.
- `services/admin/` owns admin-only API calls.
- `services/users/` owns user, river, drain, or public-mode API calls.
- `services/common/` owns shared types, helpers, polling, WebSocket helpers, and API utilities used by both modes.
- `config/` owns static module configuration.
- `admin/` and `users/` own mode-specific UI, hooks, and stores.
- A module should not contain a local `shared/ui/` folder when `dss_common` already has the reusable UI.

If a module has only one mode, keep the same ownership rules and omit the unused mode folder.

---

## 5. Root Page Standard

The root `page.tsx` is the orchestration layer.

It may own:

- current mode selection
- top-level layout composition
- left rail actions
- module information modal state
- responsive breakpoint detection
- panel open/close state
- panel width and height state
- loading overlay coordination
- choosing which admin/user components to render
- choosing which data-init wrapper to use

It must not own:

- backend request details
- map layer construction
- OpenLayers setup
- category scoring logic
- report generation internals
- large selection workflow logic
- table column definitions when table/CSV output exists

The page should compose the screen using the shared layout shell when the module follows the DSS panel pattern.

Expected layout composition:

```text
PageLayout
  leftPanel           required
  mapContent          required
  rightPanel          required
  rightPanelToggle    required when the right panel can collapse
  bottomPanel         optional, only for table/CSV or requested bottom results
```

The page is allowed to be the coordinator. It should not become the module.

---

## 6. Layout And Panel Standard

For map-based DSS modules, the standard layout uses:

- left selection panel
- center map workspace
- right analysis/workflow panel
- bottom tabular results panel, only when needed

The left panel, map workspace, and right panel are required for this DSS architecture.

The bottom panel is optional. Do not add it just because another module has one.

Before adding a bottom panel, confirm the need. If the user has not clearly asked for one and the module does not obviously need table/CSV output, ask:

```text
Do you need a bottom panel for table or CSV results, or should results stay inside the right panel/map workflow?
```

If the module has no table data, no CSV export, and no user-requested bottom workspace, skip the bottom panel.

The shared shell should remain dumb. It receives content and layout values by props. It should not know module-specific business rules.

### Left panel

The left panel owns selection and setup:

- location selection
- river or drain selection
- uploaded input selection
- confirmation/edit/reset flow

Rules:

- left panel may open by default on desktop
- left panel should overlay the map workspace
- the panel width must come from config
- edit should unlock the workflow without clearing existing values
- destructive clearing must be a separate reset/clear action

### Right panel

The right panel owns analysis and workflow actions:

- category weights
- condition/constraint selection
- analysis button
- summary cards
- technology DSS workflow when that belongs beside analysis
- PDF/report status if intentionally placed there

Rules:

- right panel should start closed unless the workflow requires otherwise
- right panel toggle should appear only after the workflow unlocks it
- right panel should be resizable on desktop if the module uses a heavy analysis panel
- right-panel width must have one source of truth

### Bottom panel

The bottom panel is optional and owns tabular output only when the module needs it:

- result table
- row count
- CSV export
- report generation action
- expand/collapse action

Rules:

- use a bottom panel when the module has large table output, CSV export, or the user explicitly asks for a bottom results workspace
- do not create a bottom panel for modules that only need map layers, summary cards, charts, or small result snippets
- table data is optional, not mandatory
- bottom panel starts closed by default
- bottom panel may auto-open when table data arrives
- collapsed state should show a thin useful header
- bottom-panel height must come from config

---

## 7. Panel Configuration Standard

Panel sizing belongs in `config/panels.config.ts`.

Do not scatter panel widths and heights across `page.tsx`, panel components, and CSS classes.

Recommended baseline:

```text
left.widthOpen = "18%"
left.mobileWidthOpen = "min(18rem, calc(100vw - 4rem))"
right.widthOpen = "25%"
right.mobileWidthOpen = "min(24rem, calc(100vw - 4rem))"
right.minWidthPercent = 25
right.maxWidthPercent = 45
bottom.heightOpen = "38%"
bottom.mobileHeightOpen = "min(20rem, 46vh)"
bottom.heightClosed = "3rem"
bottom.defaultOpen = false
bottom.minHeightPercent = 22
bottom.maxHeightPercent = 55
```

Rules:

- defaults and clamp values come from config
- live resized width/height may live in root page state
- mobile widths should use capped expressions such as `min(...)` or `clamp(...)`
- avoid raw oversized mobile widths such as `92vw`
- panel components should not hardcode their own layout percentages
- bottom-panel config is required only when the module actually has a bottom panel
- table column config is required only when the module actually has table or CSV output

---

## 8. Component Ownership Standard

Create a component only when it has a clear reason to exist.

Good reasons:

- owns a visible screen area
- owns a workflow step
- connects a store to shared UI
- separates map logic from page logic
- is reused in more than one place
- keeps a file from becoming too large

Bad reasons:

- wraps one `div`
- only renames another component
- forwards props without adding behavior
- hides structure instead of clarifying it
- exists only because another module had a similarly named file

Mode-specific components should stay inside the mode folder:

```text
admin/components/
users/components/
```

Cross-mode components that are still module-specific should live here:

```text
components/
```

Truly reusable DSS UI should live here:

```text
frontend/components/dss_common/
```

During a module migration, treat `dss_common` as controlled shared infrastructure. Prefer importing existing shared components. If new shared behavior is needed, first create a module-local component or wrapper. Move it to `dss_common` only as a separate, intentional shared-component task with impact review.

---

## 9. Services And API Standard

All backend communication must live in `services/`.

Services own:

- endpoint strings
- request payload shaping
- response typing
- polling
- WebSocket task tracking helpers
- cache or dedupe helpers when needed
- API-specific error handling

UI components should call store actions or view-model actions, not raw endpoints.

Service files should be split by mode or API domain so debugging is easy.

Preferred shape:

```text
services/
  admin/
    adminSuitabilityApi.ts
  users/
    userSuitabilityApi.ts
    drainSuitabilityApi.ts
  common/
    stpSuitabilityTypes.ts
    stpSuitabilityTasks.ts
    apiClient.ts
```

Rules:

- admin-only endpoints belong in `services/admin/`
- user, river, public, or drain-mode endpoints belong in `services/users/`
- shared request/response types belong in `services/common/`
- task polling, WebSocket helpers, and request dedupe helpers belong in `services/common/` when both modes use them
- if an API is truly shared and small, it may live in `services/common/`, but do not hide admin-specific and drain-specific behavior in one large mixed file
- keep endpoint URLs out of components
- keep request body construction out of JSX
- type important request and response shapes
- preserve legacy payload contracts when migrating
- if the old module sends a returned `vector_layer` as `village_layer`, document and preserve that behavior
- if an async task returns `task_id`, centralize polling or WebSocket handling in the service layer

---

## 10. Store Standard

Stores own shared state and domain actions.

Split stores by domain, not by component.

Common store domains:

- location or river selection store
- category store
- map store
- UI/report store
- technology/workflow store if the domain is large enough

Examples:

```text
admin/stores/adminLocationStore.ts
admin/stores/adminCategoryStore.ts
admin/stores/adminMapStore.ts
admin/stores/adminUiStore.ts

users/stores/userRiverStore.ts
users/stores/userCategoryStore.ts
users/stores/userMapStore.ts
users/stores/userUiStore.ts
```

Rules:

- one piece of state has one owner
- do not mirror the same state in multiple stores
- local component state is allowed for local UI only
- store actions should do real domain work
- edit actions should not clear confirmed values
- reset actions may clear values, but must be explicit
- panel size defaults belong in config, not stores

State that belongs in stores:

- selected location, river, stretch, drain, catchment
- locked/confirmed selection state
- category weights and selected categories
- analysis results
- selected raster layer
- result vector/path layer names
- report task id and progress state
- legend visibility when shared across map controls

State that can stay local:

- dropdown open state
- hover state
- temporary active tab
- map fullscreen toggle if only the map uses it

---

## 11. View Model Hook Standard

Use view-model hooks when a screen needs to combine many stores or actions.

Examples:

```text
admin/hooks/useAdminViewModel.ts
users/hooks/useUserViewModel.ts
```

View models may:

- collect values from several stores
- expose screen-ready values
- validate before submit
- call store actions in the correct order
- start analysis
- start report generation
- coordinate panel behavior through exposed flags/actions

View models must not:

- become a second store
- duplicate state without reason
- fetch raw endpoints directly
- contain map setup logic
- grow into a hidden page component

The view model is the place for orchestration. Stores own state. Services own APIs. Components render UI.

---

## 12. Map Architecture Standard

Map files are allowed to be larger than ordinary UI files because map setup has real complexity.

A map file may own:

- OpenLayers setup
- base map setup
- WMS/WFS layer loading
- vector layer styling
- layer ordering and z-index
- hover and click interactions
- fit-to-layer behavior
- map-specific panels
- legend rendering
- raster selector rendering
- map tools

A map file must not own:

- route switching
- page layout
- report business flow
- category form workflow
- backend endpoint strings
- high-level selection confirmation logic

Shared map UI should come from `dss_common` or map-core helpers when available:

- map header controls
- base map picker
- raster selector
- close icon
- module information modal
- common map helpers

Rules:

- map workspace should normally render full-bleed in its assigned area
- avoid decorative framing around the live map unless there is a real UX reason
- result layers should render above base/raster layers
- returned vector/path layers should not be fetched repeatedly for the same layer name
- visibility changes should update existing layers where possible
- mobile floating controls must not cover open side panels

---

## 13. Shared UI Standard

Use `@/components/dss_common/` for UI that is genuinely reusable across DSS modules.

Before building a new panel control, selection input, map control, modal, category editor, legend, or collapse button, check `frontend/components/dss_common/`.

Shared UI must:

- accept props
- avoid feature-store imports
- avoid module-specific endpoint knowledge
- avoid admin/user-specific assumptions
- be usable by more than one module

Current `dss_common` component usage:

| Component | Use it for | Do not use it for |
| --- | --- | --- |
| `PageLayout.tsx` | Main DSS shell with rail, required left panel, required map workspace, required right panel, and optional bottom panel | Module business logic, map logic, endpoint calls |
| `LeftPanelToggle.tsx` | Edge-mounted open/close control for overlay left panels | A random close button inside cards |
| `RightPanelToggle.tsx` | Edge-mounted open/close control for right analysis panels, using the live right-panel width as offset | Module-specific submit/analysis actions |
| `CollapseToggle.tsx` | Compact arrow-only expand/minimize control for cards, sections, and bottom-panel headers | Workflow actions where text is needed for clarity |
| `CategorySliderView.tsx` | Shared category/weight/selection UI; connect it through a module-local admin/user wrapper | Direct store coupling or module-specific API logic |
| `MultiSelect.tsx` | Searchable multi-select dropdowns for location, category, drain, village, or similar lists | Single-value selection |
| `SingleSelect.tsx` | Searchable single-select dropdowns for one chosen item | Multi-value selection |
| `MapHeaderControls.tsx` | Top map toolbar for layers, basemap, tools, and fullscreen actions | Module-specific analysis buttons |
| `MapRasterSelector.tsx` | Map-side raster layer selector and raster dropdown | Non-raster lists or backend selection forms |
| `BaseMaps.tsx` | Basemap chooser dock | Raster analysis result selection |
| `MapLegendOverlay.tsx` | Show/hide raster legend overlay when an active raster has a legend URL | Custom chart legends outside the map |
| `MapCoordinatesOverlay.tsx` | Map coordinate readout overlay tied to a target DOM id | General status messages |
| `ModuleInfoModal.tsx` | Module information modal opened from the rail or title info action | Workflow forms or result details |
| `CloseIcon.tsx` | Consistent close icon inside buttons | Full button behavior by itself |

Rules:

- import existing shared UI before creating a new copy
- do not change shared UI casually during a module migration
- if behavior is module-specific, create a local wrapper in the module
- if a component becomes useful across modules, promote it later with review
- wrappers should adapt module stores into shared props; shared components should not import module stores
- when a shared component is skipped, note why in the implementation or progress file if the choice affects architecture
- do not fork a shared component locally only to change text, spacing, or icons unless the shared component cannot accept props for the needed behavior
- changing `dss_common` should be treated as a shared-infrastructure change, not a normal module migration edit

---

## 14. Domain Workflow Standard

Every module has domain-specific workflow. The standard does not force every module to have identical screens, but it does require clear ownership.

For a DSS analysis workflow, document these steps:

- reference data loading
- selection input
- selection confirmation
- map visual display
- category/weight editing
- analysis request
- result raster/vector handling
- result table handling, if table output exists
- report/export handling, if the feature exists
- edit/reset behavior

For STP Suitability v2, the important workflows are:

- admin location selection
- user river/stretch/drain selection
- drain catchment or analysis layer loading
- visual display layer handling
- suitability category selection
- suitability analysis
- result raster and village table handling
- STP Technology DSS ranking
- area analysis returning cluster/path layers
- PDF report generation

Module-specific workflows should be documented in the module progress file and reflected in service/store names.

---

## 15. Legacy-To-New Migration Process

Use this sequence when migrating a legacy module.

### Phase 1: Inventory

- Identify old route files.
- Identify Context providers and global stores.
- Identify API calls and payloads.
- Identify map layers, WMS/WFS calls, and z-index behavior.
- Identify report/export flows.
- Identify user-visible behavior that must be preserved.
- Identify files that must not be edited.

### Phase 2: Target shell

- Create or align root `page.tsx`.
- Add `layout.tsx`, `loading.tsx`, and `error.tsx`.
- Add `config/panels.config.ts`.
- Use the shared page layout shell where appropriate.
- Move mode switching into root page state if the module uses in-page admin/user modes.

### Phase 3: Services

- Move raw endpoints into typed service files.
- Match legacy request and response contracts.
- Add polling/WebSocket helpers for task-based APIs.
- Keep cache/dedupe logic in services when repeated calls are a known issue.

### Phase 4: Stores

- Replace Context state with domain stores.
- Split state by location/river, category, map, and UI/report domains.
- Preserve edit and reset behavior carefully.

### Phase 5: Components

- Create the required screen areas: left selection, map workspace, and right workflow. Add bottom results only when table/CSV output exists or the user asks for it.
- Move repeated module-specific UI into root `components/`.
- Import generic UI from `dss_common`.
- Remove pass-through wrappers.

### Phase 6: Maps

- Move OpenLayers logic into mode-specific map files.
- Preserve layer order and styling.
- Prevent duplicate WFS/WMS calls where layer names have not changed.
- Keep map-local state local and shared map state in map stores.

### Phase 7: Results

- If the module has large table or CSV output, move tables into bottom panels.
- If the module does not need table/CSV output, keep the result UI in the right panel, map, or module-specific result component.
- Move CSV helpers into `utils/`.
- Keep report generation in view models and UI stores.
- Preserve result data transformations from the legacy module.

### Phase 8: Verification

- Type-check the module.
- Browser-test admin flow.
- Browser-test user flow.
- Compare network calls against legacy behavior.
- Verify map layers render once and in the right order.
- Verify analysis payloads.
- Verify result table and CSV only when the module has table/CSV output.
- Verify PDF/report and mobile layout when those features exist.

---

## 16. Progress File Standard

Every migration should maintain a progress file:

```text
PROGRESS.md
```

It should include:

- current completion percentage
- completed tasks
- pending tasks
- backend QA notes
- browser QA notes
- known blockers
- files that must not be edited
- safe edit areas
- next recommended step

The progress file is the handoff document. The module standard is the architecture law.

Do not mix them:

- `MODULE_STANDARD.md` explains how modules should be structured.
- `PROGRESS.md` explains where this specific module currently stands.

---

## 17. Verification Checklist

Before calling a migrated module complete, verify:

- root `page.tsx` is the only orchestration route
- no legacy Context providers are used
- no legacy route pages are imported
- services own backend endpoints
- stores are split by domain
- view-model hooks own screen orchestration
- map logic is isolated in map files
- result tables live in bottom panels only when the module has large table/CSV output or the user requested a bottom panel
- right panel owns workflow, not table display
- panel dimensions come from config
- edit does not behave like reset
- reset/clear is explicit
- map layers are not refetched unnecessarily
- result vector/path layers appear above base/raster layers
- CSV export works
- report/PDF task flow works
- desktop layout works
- mobile layout works
- text does not overflow cards, buttons, or headers
- old working module remains untouched

---

## 18. Anti-Patterns

Do not reintroduce these:

- route-to-route imports
- legacy Context as final state architecture
- raw `fetch` or endpoint strings inside components
- giant route files that own everything
- duplicated state across stores
- UI components that secretly own API contracts
- map setup mixed into page layout
- local `shared/ui/` folders that duplicate `dss_common`
- hardcoded panel sizes scattered across files
- edit buttons that clear selections
- repeated API calls caused by unstable effects
- copied module standards with old module names left inside

---

## 19. Completion Definition

A module follows this standard when:

- every file has a clear reason to exist
- state ownership is obvious
- API ownership is obvious
- map ownership is obvious
- the root page is understandable
- the old module's behavior is preserved
- the old module's architecture is not copied
- another developer can explain the module in a few minutes
- future modules can reuse the structure without confusion

The standard is not about having many files. It is about every file having the right job.

---

## 20. Final Rule

When in doubt, choose the structure that makes ownership clearer.

The right question is not:

```text
Where can I quickly put this code?
```

The right question is:

```text
Who should own this behavior so the next module can follow the same pattern?
```

That is the purpose of this standard.
