# Formula System Guide

This guide documents the formula system added to the 3D cabinet editor.
It covers the data model, runtime flow, UI, and where to extend behavior.

## Overview

Admins can attach mathjs expressions to cabinet dimensions and view-level
Global Dimensions (GDs). Formulas are evaluated with "puzzle pieces" (cabinet
geometry, dims, appliance gaps, benchtop settings, filler/panel positioning,
view GD values) and applied through the same handlers used by manual edits.
This ensures locks, pairing/sync, and dependent components behave the same.

Key properties:
- Expressions are stored per cabinetId + dimId.
- View GD expressions are stored per viewId + gdId.
- Results overwrite persisted dimensionValues.
- Recalculation is debounced and guarded against loops.

## Data Model and Persistence

- In-memory store:
  - `cabinetPanelState` in `src/features/cabinets/ui/productPanel/hooks/usePersistence.ts`
  - Formulas stored as `PersistedPanelState.formulas?: Record<string, string>`

- Room persistence:
  - `dimensionFormulas` + `viewGDFormulas` in `src/types/roomTypes.ts`
  - Serialized/deserialized in `src/features/scene/utils/roomPersistenceUtils.ts`
  - On room load, cabinet IDs change, so formulas are remapped via:
    - `remapFormulaIds(...)` for `cab("id", ...)`, `dim("id", ...)`, and
      `viewGd("viewId", ...)` tokens

## Runtime Flow

### Entry point

- Hook: `src/features/scene/hooks/useFormulaEngine.ts`
  - Builds puzzle pieces.
  - Evaluates formulas with mathjs.
  - Applies results through existing handlers.
  - Updates persisted dimensionValues.

- Hook: `src/features/scene/hooks/useGDFormulaEngine.ts`
  - Evaluates view-level GD formulas with the same scope helpers.
  - Applies results through `handleViewDimensionChange`.

- Integration:
  - `src/features/scene/ThreeScene.tsx` wires `useFormulaEngine` and triggers
    recalculation on `dimensionVersion` and `dragEndVersion` changes.
  - `src/features/scene/ThreeScene.tsx` wires `useGDFormulaEngine` and shares
    the same debounced recalculation triggers.

### Evaluation scope

Formulas are evaluated with these helper functions:
- `cab(cabinetId, field)`
  - field examples: `x`, `y`, `width`, `height`, `left`, `right`, etc.
- `dim(cabinetId, dimId)`
  - reads persisted dimensionValues or defaults.
- `viewGd(viewId, gdId)`
  - reads the current GD value from cabinets in that view.

All helpers return numbers (or 0 if missing).

### Triggering recalculation

Recalculations happen when:
- A formula is saved/cleared (debounced).
- Cabinet dimensions change (debounced `dimensionVersion`).
- Cabinets are moved (drag end).
- View GD formulas are saved/cleared (debounced).

### Automated View Realignment

To handle minor misalignments that can occur after complex formula-driven resizing (especially with fillers, panels, and benchtops), the system includes an automated realignment trigger. 

Whenever a formula recalculation is scheduled, a secondary debounced task is queued to run **400ms** later (after the formula evaluation pass should be complete). This task calls `realignAllViews`, which forces every cabinet in the scene to update its dependent components with `positionChanged: true`. This effectively "settles" the scene after formulas have finished applying.

Debounce timing: 
- Formula recalc: `300ms`
- View realignment: `400ms`

### Loop protection

`useFormulaEngine` caps to `MAX_PASSES` (currently `3`) and uses an EPSILON
compare to avoid oscillating updates. Admins should still avoid cycles.

## Applying Results

### View GD formulas

- GD updates apply through:
  - `handleViewDimensionChange` in
    `src/features/scene/utils/handlers/viewDimensionHandler.ts`

### Standard cabinets

Primary dimensions:
- width/height/depth apply via:
  - `handleProductDimensionChange` in
    `src/features/scene/utils/handlers/productDimensionHandler.ts`

Other dimension types (via GD mapping):
- door overhang, shelf qty, drawer qty/heights, door qty
- applied via `CarcassAssembly` APIs and `updateAllDependentComponents`

### Appliances

Targets are hardcoded and live in:
- `src/types/formulaTypes.ts`

Appliance formulas apply through:
- Width: `handleApplianceWidthChange` (sync/pair aware)
- Left/right gaps: `handleApplianceHorizontalGapChange`
- Top gap: `applyApplianceGapChange`
- Height/depth/kicker: direct carcass updates + `updateAllDependentComponents`

### Benchtops

Targets are defined in:
- `src/types/formulaTypes.ts`

Benchtop formulas apply through:
- Height from floor: updates `manuallyEditedDelta.height` for child benchtops
  (or `group.position.y` for standalone)
- Thickness: updates carcass height + dependent components
- Overhangs: updates benchtop config, depth (front), and dependent components

### Fillers/Panels

Targets are defined in:
- `src/types/formulaTypes.ts`

Filler/panel formulas apply through:
- Off-the-floor: updates `parentYOffset`, `group.position.y`, and height
  to keep the top edge fixed, then updates dependent components

## UI Integration

Minimal UI is provided for now:
- `FormulaSection` in
  `src/features/cabinets/ui/productPanel/components/FormulaSection.tsx`
  - lets admins pick a dimension, type a formula, and insert puzzle pieces
  - puzzle pieces are inserted via a stepper: choose cabinet, pick a type, then select a piece
- `GDFormulaSection` in
  `src/features/scene/ui/GDFormulaSection.tsx`
  - lets admins attach formulas to view-level GDs
  - uses the same formula editor modal and puzzle pieces

Wired into:
- ProductPanel: `src/features/cabinets/ui/productPanel/DynamicPanel.tsx`
- AppliancePanel: `src/features/cabinets/ui/AppliancePanel.tsx`
- ViewDetailDrawer: `src/features/scene/ui/ViewDetailDrawer.tsx`

The UI relies on:
- `formulaPieces` (from `useFormulaEngine`)
- `getFormula` / `onFormulaChange`
- `getGDFormula` / `onGDFormulaChange`

## Puzzle Pieces

Pieces are generated in:
- `buildFormulaPieces(...)` inside
  `src/features/scene/hooks/useFormulaEngine.ts`

Categories include:
- Geometry: position, width/height/depth, left/right/top/bottom edges
- Product dimensions (from wsProduct dims)
- Appliance visuals and gaps (visual width/height, top/left/right gaps, kicker)
- Benchtop settings (height from floor, thickness, overhangs)
- Filler/panel positioning (off-the-floor)
- View GD values (grouped by view)

To add new pieces:
1) Update `buildFormulaPieces` to add tokens and labels.
2) Extend `getCabinetField` or `getCabinetDimValue` to resolve the new token.

## File Map (Quick Reference)

- Engine and evaluation:
  - `src/features/scene/hooks/useFormulaEngine.ts`
  - `src/features/scene/hooks/useGDFormulaEngine.ts`

- Room persistence:
  - `src/types/roomTypes.ts`
  - `src/features/scene/utils/roomPersistenceUtils.ts`

- UI:
  - `src/features/cabinets/ui/productPanel/components/FormulaSection.tsx`
  - `src/features/scene/ui/GDFormulaSection.tsx`
  - `src/features/cabinets/ui/productPanel/DynamicPanel.tsx`
  - `src/features/cabinets/ui/AppliancePanel.tsx`
  - `src/features/scene/ui/ViewDetailDrawer.tsx`

- Dimension application:
  - `src/features/scene/utils/handlers/productDimensionHandler.ts`
  - `src/features/scene/utils/handlers/applianceDimensionHandler.ts`
  - `src/features/scene/utils/handlers/applianceGapHandler.ts`
  - `src/features/scene/utils/handlers/dependentComponentsHandler.ts`

## Extending the System

Common extensions:
- Add new formula targets for appliances:
  - Update `APPLIANCE_FORMULA_DIMENSIONS` in `src/types/formulaTypes.ts`
  - Add value resolver in `getApplianceFormulaValue`
  - Add apply behavior in `applyApplianceFormulaValue`

- Add new benchtop or filler/panel formula targets:
  - Update `BENCHTOP_FORMULA_DIMENSIONS` or `FILLER_PANEL_FORMULA_DIMENSIONS`
    in `src/types/formulaTypes.ts`
  - Add value resolver in `getBenchtopFormulaValue` or
    `getFillerPanelFormulaValue`
  - Add apply behavior in `applyBenchtopFormulaValue` or
    `applyFillerPanelFormulaValue`

- Add new product-dimension behaviors:
  - Extend GD mapping handling in `applyProductFormulaUpdates`

- Add new puzzle pieces:
  - Add token in `buildFormulaPieces`
  - Resolve in `getCabinetField` or `getCabinetDimValue`

## Known Limitations

- Formula loops are limited by `MAX_PASSES` but not fully prevented.
- Expression errors are logged and skipped for that formula.

If you extend the engine, follow the existing handlers so sync/locks/dependent
updates continue to work.
