# Cabinets module responsibilities

- cabinetFactory: pure creation of carcass assemblies with sensible defaults
- cabinet-adapter: map UI/ProductPanel events to CarcassAssembly API
- hooks and UI: cabinets state, selection, and presentational controls
- product panel: split by SRP into container, state hook, and view

## Contracts

- cabinetFactory
  - createCabinet(type, subId, opts?) -> { group, carcass, cabinetType, subcategoryId }
- cabinet-adapter
  - applyDimensions(c, dims) / applyMaterialProps(c, changes) / applyKicker(c, height)
  - toggleDoors(c, on) / setDoorMaterial(c, m) / setDoorCount(c, n) / setOverhang(c, on)
  - toggleDrawers(c, on) / setDrawerQty(c, n) / setDrawerHeight(c, i, h)
  - balanceDrawerHeights(c) / resetDrawerHeights(c)
- useCabinets
  - manages collection state and selection
  - createCabinet(type, subId), clearCabinets(), setters for selection and panel visibility

## TL;DR: ProductPanel SRP

### useProductPanelState

Encapsulates ProductPanel state, derived values, and all side effects

- inputs: `(selectedCabinet, callbacks)`
- returns state: `dimensions`, `materials`, `kickerHeight`, `doorEnabled` (+ material/count/overhang), `drawerEnabled` (+ quantity/heights), editing flags, expansion state
- handlers: `handleDimensionChange`, `handleMaterialChange`, `handleKickerHeightChange`, door handlers, drawer handlers, balancing and proportional helpers

Use when you want to unit test behavior without rendering

### ProductPanelView

Pure presentational; renders controls using injected state and handlers

- props: `isVisible`, `onClose`, `selectedCabinet`, plus the bags returned by `useProductPanelState`
- no side-effects; just UI with Tailwind styling

### ProductPanel (container)

Thinnest component that wires `useProductPanelState` to `ProductPanelView`

- props: same public API as before to keep scene integration intact

### productPanel.types

Centralized contracts between container, hook, and view

- `SelectedCabinetSnapshot`, `ProductPanelProps`, `ProductPanelCallbacks`
- `DimensionConstraints` built from `categoriesData`

### cabinet-adapter (UI -> carcass API)

Tiny wrappers that translate ProductPanel changes to `CarcassAssembly` API calls

- `applyDimensions`, `applyMaterialProps`, `applyKicker`
- `toggleDoors`, `setDoorMaterial`, `setDoorCount`, `setOverhang`
- `toggleDrawers`, `setDrawerQty`, `setDrawerHeight`
- `balanceDrawerHeights`, `resetDrawerHeights`

## Notes

- Keep view logic dumb; move calculations and effects into the hook
- Preserve editing guards to avoid fighting with live sync while the user types
- Prefer adapter helpers in callbacks to avoid leaking Three/Carcass details into UI
