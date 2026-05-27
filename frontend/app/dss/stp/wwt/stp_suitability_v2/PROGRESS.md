# STP Suitability v2 Architecture Progress

Last updated: 2026-05-08

## Progress Snapshot

Overall progress: **89% complete**

Tasks complete: **71 / 81 core migration tasks**

Latest requested behavior updates: **5 / 5 implemented, pending browser QA**

Current next step: **Step 72 - Verify user/drain selection flow; currently blocked because backend catchment lookup returns zero catchments for available drains.**

Important rule: **Do not change `frontend/app/dss/stp/wwt/stp_suitability/`.** The existing STP Suitability module is working and must remain untouched. Use it only as a behavior reference.

Shared UI rule: **Do not change `frontend/components/dss_common/`.** If a shared component is needed, import it into `stp_suitability_v2` and wrap/adapt it locally inside this module. Any module-specific behavior must live inside `stp_suitability_v2`, not in `dss_common`.

Architecture rule: **Do not introduce React Context into `stp_suitability_v2`.** The v2 module should follow the `stp_priority` and `mar_suitability_v2` architecture: root page orchestration, typed services, domain stores, view-model hooks, mode-specific components, shared `dss_common` UI, and module-root shared components only when they are STP-specific.

## Goal

Convert `frontend/app/dss/stp/wwt/stp_suitability_v2/` into the same frontend architecture used by `frontend/app/dss/stp/wwt/stp_priority/` and documented in `frontend/app/dss/stp/wwt/stp_priority/MODULE_STANDARD.md`.

The migration priority is:

1. Architecture first.
2. UI refinement second.
3. Preserve the working behavior from the old `stp_suitability` module.
4. Do not import old context providers or legacy route pages into v2.

The closest reference module is:

```text
frontend/app/dss/gwm/mar_suitability_v2/
```

The strict architecture standard is:

```text
frontend/app/dss/stp/wwt/stp_priority/MODULE_STANDARD.md
```

## Current State

The v2 module already has a useful starting structure:

- root `page.tsx`
- `layout.tsx`, `loading.tsx`, `error.tsx`
- `admin/components`, `admin/hooks`, `admin/stores`
- `users/components`, `users/hooks`, `users/stores`
- `config/`
- `services/`
- mode-specific data init components
- mode-specific left panels
- mode-specific right panels
- mode-specific OpenLayers map wrappers
- typed API service and type file
- Zustand-style stores instead of React Context

The v2 module is closer to the module standard now. Remaining alignment gaps:

- no source imports from `shared/` remain; empty local `shared/` directories may still exist on disk and can be removed by cleanup
- dark/light theme service is intentionally not retained in this pass; STP Suitability v2 currently remains light-only
- STP Technology DSS has been ported locally, but it still needs full workflow QA against the old working module
- latest source checks pass with local TypeScript and route smoke verification
- backend-authenticated admin reference data, visual display, and suitability analysis have been verified with a local QA JWT
- v2 now stores the visual-display `vector_layer` and sends it back as `village_layer` during suitability analysis, matching the legacy module contract
- treatment cluster payload now matches FastAPI snake_case fields and derives town/drain coordinates locally from v2 stores
- treatment technology options use a local fallback because the running backend currently returns `404` for `/stp_operation/get_stp_suitability_area`
- category selection now matches the MAR v2 pattern: admin/user wrappers import `@/components/dss_common/CategorySliderView` locally and adapt STP store data into `CategorySliderModel`
- all suitability category items are selected by default in both admin mode and drain mode; reset also restores all condition and constraint categories as selected
- CSV export now mirrors the MAR v2 helper shape by using `@/interface/table` `DataRow`, the shared `downloadCSV`, and a default `STP_Suitability.csv` filename
- clicking **Analyze Suitability** now minimizes/collapses the bottom results table before starting the new analysis
- STP bottom results now include the MAR-style colored **Composition** column for Very Low, Low, Medium, High, and Very High percentages
- STP right panels now include a local `PriorityRiskSummary` equivalent to MAR v2, backed by module-local risk-count utilities and category-store `villageRiskCounts`; it renders as a separate card directly below the suitability category section, not inside the category table/card
- `Treatment Area Finder` is intentionally commented out/disabled for now in `components/SuitabilityWorkflowPanel.tsx`
- STP Technology DSS results now include the legacy-style **Find Area Analysis** action; it calls the v2 service for `POST /stp_operation/stp_suitability_area` with selected technology land factor, MLD capacity, suitability raster layer name, `custom_land_per_mld: 2`, and selected town/drain coordinates
- clicking **Analyze Suitability** suppresses the next bottom-panel auto-open so the bottom table stays minimized even after fresh analysis results are written
- latest source check after STP Technology DSS area-analysis integration: `tsc --noEmit` passes and `/dss/stp/wwt/stp_suitability_v2` returns HTTP 200 locally

## Latest Backend QA Notes

Last backend QA pass: **2026-05-08**

Verified with an authenticated local QA token against `http://127.0.0.1:3000/api`:

- suitability categories load: **11 condition rasters**, **8 constraint rasters**
- admin reference data loads: **36 states**, **732 districts**, **6311 sub-districts**, **39 towns**
- user/drain reference data loads: **3 rivers**, **304 stretches**, **301 drains**
- admin visual display works for sample town `Asapur (CT), V` (`id=24`) and returns **19 raster layers** plus a `vector_layer`
- admin suitability analysis works when `village_layer` is included; sample run returned raster layer `STP_suitability_cc846c69a1024fb49694784410fd285f` and **154 table rows**
- admin report start works; sample run returned task id `6dab1b1d-8ae6-49be-9996-6e8768f89b99`
- report WebSocket connects and returns a `PENDING` progress message

Blocked / not complete:

- user/drain catchment lookup returned a temporary `layer_name` but **0 catchments**, even when all **301 drains** were submitted
- treatment area/cluster task starts through the v2 service, but polling `/stp_operation/stp_area/{task_id}` did not return `cluster_layer` or `suitable_path` within the earlier test window
- PDF generation was verified only through task start and first WebSocket progress message, not final PDF download
- full browser click-through QA is still pending

## Target Folder Shape

Final structure should look like this:

```text
stp_suitability_v2/
  layout.tsx
  page.tsx
  loading.tsx
  error.tsx
  PdfGenerationStatus.tsx
  PROGRESS.md

  config/
    mapModes.ts
    panels.config.ts
    villageTableColumns.tsx

  services/
    stpSuitabilityApi.ts
    stpSuitabilityTypes.ts
    uiModeService.ts

  components/
    PriorityRiskSummary.tsx
    SuitabilityTreatmentCard.tsx
    SuitabilityWorkflowPanel.tsx
    StpTechnologyDss.tsx
    StepProgress.tsx
    WizardScreen.tsx
    InputsScreen.tsx
    PerfTableScreen.tsx
    ResultsScreen.tsx
    ScoreChart.tsx

  utils/
    downloadSuitabilityCsv.ts
    riskFactorSummary.ts
    stpTechnologyScoring.ts

  admin/
    loading.tsx
    error.tsx
    components/
      AdminDataInit.tsx
      AdminLeftPanel.tsx
      AdminRightPanel.tsx
      AdminBottomResultsPanel.tsx
      AdminCategorySlider.tsx
      AdminOpenLayersMap.tsx
      LocationSelector.tsx
    hooks/
      useAdminViewModel.ts
    stores/
      adminLocationStore.ts
      adminCategoryStore.ts
      adminMapStore.ts
      adminUiStore.ts

  users/
    loading.tsx
    error.tsx
    components/
      UserDataInit.tsx
      UserLeftPanel.tsx
      UserRightPanel.tsx
      UserBottomResultsPanel.tsx
      UserCategorySlider.tsx
      UserOpenLayersMap.tsx
      RiverSelector.tsx
    hooks/
      useUserViewModel.ts
    stores/
      userRiverStore.ts
      userCategoryStore.ts
      userMapStore.ts
      userUiStore.ts
```

The final module should not contain:

```text
stp_suitability_v2/admin/page.tsx
stp_suitability_v2/users/page.tsx
stp_suitability_v2/shared/
```

Remove those only after their responsibilities have been moved safely.

## Task Checklist

### Phase 1 - Guardrails And Inventory

- [x] 1. Confirm the old working module must not be edited.
- [x] 2. Confirm v2 must not use the old React Context architecture.
- [x] 3. Read `stp_priority/MODULE_STANDARD.md`.
- [x] 4. Compare `stp_suitability_v2` against `stp_priority`.
- [x] 5. Compare `stp_suitability_v2` against `mar_suitability_v2`.
- [x] 6. Identify that `stp_suitability_v2/shared/` is not the final target architecture.
- [x] 7. Identify that table results need to move out of the right panel into bottom panels.
- [x] 8. Identify that route files under `admin/` and `users/` should not remain in the final architecture.
- [x] 9. Create this progress handoff file.

### Phase 2 - Root Architecture

- [x] 10. Update `config/panels.config.ts` to include `bottom` settings matching the standard.

  Required baseline values:

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

- [x] 11. Move the orchestration from `shared/layout/StpSuitabilityShell.tsx` into root `page.tsx`.
- [x] 12. Make root `page.tsx` follow the `stp_priority/page.tsx` pattern directly.
- [x] 13. Keep the root page responsible for mode switching, rail buttons, panel widths, bottom panel height, mobile detection, loading overlay, module info modal, and data-init wrapper selection.
- [x] 14. Add bottom panel state to root `page.tsx`.
- [x] 15. Auto-open the bottom panel when active table data becomes available.
- [x] 16. Show the right-panel toggle only after selections are locked.
- [x] 17. Keep right panel closed by default until the workflow unlocks it.
- [x] 18. Remove the final dependency on `StpSuitabilityShell.tsx`.

### Phase 3 - Route Cleanup

- [x] 19. Remove `admin/page.tsx` and `users/page.tsx` after root page supports both modes completely.
- [x] 20. Keep `admin/loading.tsx`, `admin/error.tsx`, `users/loading.tsx`, and `users/error.tsx`.
- [x] 21. Verify no route-to-route imports remain inside v2.

### Phase 4 - Shared UI Cleanup

- [x] 22. Replace the module-local category selector with local admin/user wrappers around `@/components/dss_common/CategorySliderView`, matching MAR v2 while keeping all STP-specific adaptation inside `stp_suitability_v2`.
- [x] 23. Delete module-local `shared/ui/RightPanelToggle.tsx` if unused, because `@/components/dss_common/RightPanelToggle` is the standard.
- [x] 24. Move STP-specific shared UI from `shared/ui/` into root `components/`.

  STP-specific candidates:

  ```text
  components/SuitabilityWorkflowPanel.tsx
  components/SuitabilityTreatmentCard.tsx
  ```

- [x] 25. Replace module-local `shared/map/OpenLayersWorkspace.tsx` with either:

  - mode-specific map files using shared `dss_common` controls directly, or
  - a root module component if it is genuinely STP-specific and shared across admin/user.

  Do not keep it under `shared/map/`.

### Phase 5 - Right Panel Split

- [x] 26. Create `admin/components/AdminCategorySlider.tsx`.
- [x] 27. Create `users/components/UserCategorySlider.tsx`.
- [x] 28. Refactor `AdminRightPanel.tsx` so it owns only right-side workflow:

  - category weights
  - condition/constraint selection
  - analysis action
  - treatment technology / cluster action if this belongs beside analysis
  - PDF status only if intentionally located there

- [x] 29. Refactor `UserRightPanel.tsx` with the same ownership rules.
- [x] 30. Remove village table rendering from right panels.

### Phase 6 - Bottom Results Panel

- [x] 31. Create `config/villageTableColumns.tsx` for STP Suitability village result columns.
- [x] 32. Create `utils/downloadSuitabilityCsv.ts`.
- [x] 33. Create `admin/components/AdminBottomResultsPanel.tsx`.
- [x] 34. Create `users/components/UserBottomResultsPanel.tsx`.
- [x] 35. Bottom panel must show:

  - collapsed header strip
  - row count
  - CSV action
  - report action
  - expand/minimize action
  - table only when expanded

- [x] 36. Root `page.tsx` must pass bottom panel content into `PageLayout`.
- [x] 37. Root `page.tsx` must pass:

  ```text
  bottomPanel
  isBottomOpen
  bottomPanelOpenHeight
  bottomPanelClosedHeight
  ```

### Phase 7 - Services And Stores

- [x] 38. Add `services/uiModeService.ts` if dark/light mode is retained.

  Decision: dark/light mode is not retained for this pass. The module remains light-only to avoid adding incomplete dark styling across STP-specific panels.
- [x] 39. Keep all backend endpoint strings inside `services/stpSuitabilityApi.ts`.
- [x] 40. Make sure UI files do not call raw endpoints directly.
- [x] 41. Keep PDF report flow inside view-model hooks and UI stores.
- [x] 42. Keep selection state in location/river stores.
- [x] 43. Keep raster, analysis, vector result, and map loading state in map stores.
- [x] 44. Keep category selections, area options, and table data in category stores.
- [x] 45. Keep right panel state, report state, PDF task state, and treatment loading in UI stores.
- [x] 46. Confirm `Edit` unlocks selections without clearing values.
- [x] 47. Add explicit reset actions only where destructive clearing is needed.

### Phase 8 - STP Technology DSS Integration

- [x] 48. Port STP technology DSS workflow into v2 without importing old pages or contexts.
- [x] 49. Decide where the technology DSS belongs:

  Preferred starting point:

  ```text
  components/StpTechnologyDss.tsx
  ```

- [x] 50. Move scoring helpers into:

  ```text
  utils/stpTechnologyScoring.ts
  ```

- [x] 51. Move step and technology data into a v2-safe config, service type file, or existing shared interface only if it does not pull legacy context.
- [x] 52. Store DSS state in a v2 store if multiple components need it.
- [x] 53. Do not use `useSTPStore` from the old module unless it is confirmed to be module-neutral and does not couple v2 to old pages or contexts.
- [x] 54. Connect treatment area/cluster search through the v2 view model and `stpSuitabilityApi.ts`; the action is now available from the STP Technology DSS results step as **Find Area Analysis**.

### Phase 9 - Map Architecture

- [x] 55. Keep `AdminOpenLayersMap.tsx` and `UserOpenLayersMap.tsx` as the mode-specific map owners.
- [x] 56. Use shared map UI from `@/components/dss_common/`:

  ```text
  MapHeaderControls
  BaseMaps
  MapRasterSelector
  CloseIcon
  ModuleInfoModal
  ```

- [x] 57. Keep map-local UI state local only when it is truly map-local.
- [x] 58. Keep selected raster layer and legend visibility in map stores.
- [x] 59. Ensure raster legend can be closed and reopened without losing the selected raster.
- [x] 60. Avoid decorative map framing unless required by UX.

### Phase 10 - UI Refinement

- [x] 61. After architecture is aligned, refine right panel UI.
- [x] 62. After architecture is aligned, refine bottom panel UI.
- [x] 63. Use shared `dss_common` components where possible.
- [x] 64. Avoid duplicated summary cards in the same panel.
- [x] 65. Keep selection summary in only one clear place.
- [x] 66. Make mobile panel widths use `min(...)` or `clamp(...)`, not raw oversized viewport widths.
- [x] 67. Ensure mobile map controls do not overlap side panels.
- [x] 68. Ensure text does not overflow buttons, headers, or cards.

### Phase 11 - Verification

- [x] 69. Run type checking or linting if available.
- [x] 70. Run the frontend dev server.
- [x] 71. Verify admin selection flow.
- [ ] 72. Verify user/drain selection flow.
- [ ] 73. Verify category selection and weight editing.
- [ ] 74. Verify suitability analysis.
- [ ] 75. Verify raster selection and legend behavior.
- [ ] 76. Verify treatment cluster action.
- [ ] 77. Verify bottom table auto-opens after results.
- [ ] 78. Verify CSV export for admin and user.
- [ ] 79. Verify PDF report generation and WebSocket progress.
- [ ] 80. Verify desktop layout.
- [ ] 81. Verify mobile layout.

## Start Here For The Next Agent

Begin at **Step 72**.

Recommended first implementation sequence:

1. Browser-verify that admin and drain modes open with all condition and constraint categories selected by default.
2. Browser-verify category weight editing and clear/select-all behavior after the shared selector alignment.
3. Confirm that clicking **Analyze Suitability** collapses the bottom results table and keeps it minimized when the new result rows arrive.
4. Investigate why `/stp_operation/get_suitability_cachement` returns zero catchments for the available drain data.
5. After catchments are available, run full browser QA for the user/drain workflow with backend data.
6. Re-run admin browser QA to confirm the fixed `vector_layer` -> `village_layer` analysis path from the UI.
7. Verify the STP Suitability Insights summary appears as its own card directly below the category section after analysis in both admin and drain mode.
8. Verify STP Technology DSS **Find Area Analysis** calls `/stp_operation/stp_suitability_area` and displays returned `cluster_layer` / `suitable_path` on the map.
9. Verify raster legend reopen, CSV export, final PDF download, and treatment cluster generation.
10. Compare the local STP Technology DSS behavior against the old working module.

Do not begin with visual cleanup. The main goal is the architecture.

## Files That Must Not Be Edited For This Migration

```text
frontend/app/dss/stp/wwt/stp_suitability/
```

This is the working legacy module.

## Files That Are Safe To Edit

```text
frontend/app/dss/stp/wwt/stp_suitability_v2/
```

Shared components may be edited only when the change is genuinely reusable and does not break other DSS modules:

```text
frontend/components/dss_common/
```

Update: for this migration, treat `frontend/components/dss_common/` as read-only. Import from it, but do not edit it. If behavior must change for STP Suitability v2, create a local wrapper or module-specific component under `stp_suitability_v2/`.

## Completion Definition

The v2 conversion is complete when:

- `stp_suitability_v2/page.tsx` directly owns root orchestration.
- `PageLayout` from `@/components/dss_common/` is the only page shell.
- there is no `stp_suitability_v2/shared/` folder.
- there are no `admin/page.tsx` or `users/page.tsx` files.
- no old STP Suitability Context providers are used.
- services own backend access.
- stores are split by domain.
- view-model hooks own workflow orchestration.
- map logic is isolated in map files.
- table results live in bottom panels.
- right panels own analysis workflow, not table display.
- panel dimensions come from `config/panels.config.ts`.
- the old `stp_suitability` module remains untouched and working.
