# Formula System Guide

This guide documents the formula system added to the 3D cabinet editor.
It covers the data model, runtime flow, UI, and where to extend behavior.

## Overview

Admins can attach mathjs expressions to cabinet dimensions. Formulas are
evaluated with "puzzle pieces" (cabinet geometry, dims, appliance gaps) and
applied through the same handlers used by manual edits. This ensures locks,
pairing/sync, and dependent components behave the same.

Key properties:
- Expressions are stored per cabinetId + dimId.
- Results overwrite persisted dimensionValues.
- Recalculation is debounced and guarded against loops.

## Data Model and Persistence

- In-memory store:
  - `cabinetPanelState` in `src/features/cabinets/ui/productPanel/hooks/usePersistence.ts`
  - Formulas stored as `PersistedPanelState.formulas?: Record<string, string>`

- Room persistence:
  - `dimensionFormulas` in `src/types/roomTypes.ts`
  - Serialized/deserialized in `src/features/scene/utils/roomPersistenceUtils.ts`
  - On room load, cabinet IDs change, so formulas are remapped via:
    - `remapFormulaIds(...)` for `cab("id", ...)` and `dim("id", ...)` tokens

## Runtime Flow

### Entry point

- Hook: `src/features/scene/hooks/useFormulaEngine.ts`
  - Builds puzzle pieces.
  - Evaluates formulas with mathjs.
  - Applies results through existing handlers.
  - Updates persisted dimensionValues.

- Integration:
  - `src/features/scene/ThreeScene.tsx` wires `useFormulaEngine` and triggers
    recalculation on `dimensionVersion` and `dragEndVersion` changes.

### Evaluation scope

Formulas are evaluated with these helper functions:
- `cab(cabinetId, field)`
  - field examples: `x`, `y`, `width`, `height`, `left`, `right`, etc.
- `dim(cabinetId, dimId)`
  - reads persisted dimensionValues or defaults.

Both helpers return numbers (or 0 if missing).

### Triggering recalculation

Recalculations happen when:
- A formula is saved/cleared (debounced).
- Cabinet dimensions change (debounced `dimensionVersion`).
- Cabinets are moved (drag end).

Debounce timing is in `useFormulaEngine` (`300ms`).

### Loop protection

`useFormulaEngine` caps to `MAX_PASSES` (currently `3`) and uses an EPSILON
compare to avoid oscillating updates. Admins should still avoid cycles.

## Applying Results

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

## UI Integration

Minimal UI is provided for now:
- `FormulaSection` in
  `src/features/cabinets/ui/productPanel/components/FormulaSection.tsx`
  - lets admins pick a dimension, type a formula, and insert puzzle pieces
  - puzzle pieces are inserted via a stepper: choose cabinet, pick a type, then select a piece

Wired into:
- ProductPanel: `src/features/cabinets/ui/productPanel/DynamicPanel.tsx`
- AppliancePanel: `src/features/cabinets/ui/AppliancePanel.tsx`

The UI relies on:
- `formulaPieces` (from `useFormulaEngine`)
- `getFormula` / `onFormulaChange`

## Puzzle Pieces

Pieces are generated in:
- `buildFormulaPieces(...)` inside
  `src/features/scene/hooks/useFormulaEngine.ts`

Categories include:
- Geometry: position, width/height/depth, left/right/top/bottom edges
- Product dimensions (from wsProduct dims)
- Appliance visuals and gaps (visual width/height, top/left/right gaps, kicker)

To add new pieces:
1) Update `buildFormulaPieces` to add tokens and labels.
2) Extend `getCabinetField` or `getCabinetDimValue` to resolve the new token.

## File Map (Quick Reference)

- Engine and evaluation:
  - `src/features/scene/hooks/useFormulaEngine.ts`

- Room persistence:
  - `src/types/roomTypes.ts`
  - `src/features/scene/utils/roomPersistenceUtils.ts`

- UI:
  - `src/features/cabinets/ui/productPanel/components/FormulaSection.tsx`
  - `src/features/cabinets/ui/productPanel/DynamicPanel.tsx`
  - `src/features/cabinets/ui/AppliancePanel.tsx`

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
