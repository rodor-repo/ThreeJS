# AI Coding Assistant Guide: ProductPanel Component System

This guide provides a high-level overview of the `ProductPanel` component system and its dependencies. It is designed to help AI assistants and developers understand the architecture, key components, hooks, and data flow within the cabinet property editing module.

## Entry Point: `src/features/cabinets/ui/ProductPanel.tsx`

`ProductPanel.tsx` is a thin wrapper that provides a clean public API for the ProductPanel component. The actual implementation lives in the `productPanel/` subfolder.

### Key Responsibilities:

- Re-exports commonly used utilities (`toNum`, `toastThrottled`, `cabinetPanelState`)
- Exports the main `ProductPanel` component (which wraps `DynamicPanelWithQuery`)
- Provides backward compatibility for external consumers

---

## Main Components

### 1. `DynamicPanelWithQuery`

- **Location**: `src/features/cabinets/ui/productPanel/DynamicPanelWithQuery.tsx`
- **Purpose**: **Data fetching layer** using React Query.
- **Responsibilities**:
  - Fetches product data via `getProductData` based on `productId`
  - Syncs `materialOptions` and `defaultMaterialSelections` to `PartDataManager` for nesting
  - Initializes drawer/door quantities from product defaults
  - Passes all fetched data as props to `DynamicPanel`

### 2. `DynamicPanel`

- **Location**: `src/features/cabinets/ui/productPanel/DynamicPanel.tsx`
- **Purpose**: **Main rendering component** that composes all hooks and UI elements.
- **Responsibilities**:
  - Manages UI state (expand/collapse, open color picker modal)
  - Composes all custom hooks for state management
  - Renders all UI sections (header, dimensions, materials, views, etc.)
  - Handles callbacks for dimension, material, group, and sync changes

---

## Core Hooks

These hooks form the backbone of the ProductPanel state management.

### 1. `useGDMapping`

- **Location**: `src/features/cabinets/ui/productPanel/hooks/useGDMapping.ts`
- **Purpose**: Maps **General Dimension (GD) IDs** to dimension types.
- **Responsibilities**:
  - Derives GD ID lists from `threeJsGDs` configuration
  - Provides mappings for: width, height, depth, door overhang, shelf qty, drawer qty, door qty
  - Maps drawer heights to indices (drawerH1..drawerH5)
  - Provides helper functions: `isWidthGD`, `isHeightGD`, `getDrawerHeightIndex`, `getDimensionBadges`

### 2. `usePanelState`

- **Location**: `src/features/cabinets/ui/productPanel/hooks/usePanelState.ts`
- **Purpose**: Manages **all panel state** in one place.
- **Responsibilities**:
  - Maintains dimension `values` (Record<string, number | string>)
  - Maintains `materialColor` (hex string)
  - Maintains `materialSelections` (selections for each material ID)
  - Maintains `editingValues` (temporary input buffer for validation)
  - Provides `debouncedInputs` for price calculation (400ms debounce)
  - Provides update functions: `updateValue`, `updateMaterialSelection`, `resetAllValues`, `resetValue`

### 3. `usePersistence`

- **Location**: `src/features/cabinets/ui/productPanel/hooks/usePersistence.ts`
- **Purpose**: **In-memory state persistence** across panel reopens.
- **Responsibilities**:
  - Uses global `cabinetPanelState` Map to store state per cabinet ID
  - Stores: `values`, `materialColor`, `materialSelections`, `price`
  - Provides operations: `getPersisted`, `setPersisted`, `updateValues`, `updateSingleValue`, `updatePrice`
  - State survives panel close/reopen within the same session

### 4. `usePriceQuery`

- **Location**: `src/features/cabinets/ui/productPanel/hooks/usePriceQuery.ts`
- **Purpose**: **Real-time price calculation** using React Query.
- **Responsibilities**:
  - Calls `calculateWsProductPrice` API with debounced inputs
  - Only runs when panel is visible and product data is loaded
  - Provides: `priceData`, `isPriceFetching`, `isPriceError`, `queryStatus`
  - Triggers `onPriceUpdate` callback when price changes

### 5. `useOffTheFloor`

- **Location**: `src/features/cabinets/ui/productPanel/hooks/useOffTheFloor.ts`
- **Purpose**: Manages **Y-position** for fillers and panels.
- **Responsibilities**:
  - Tracks `offTheFloor` value (0-1200mm range)
  - Initializes from cabinet's current Y position
  - Updates cabinet position when value changes
  - Adjusts cabinet height to maintain top position
  - Updates parent kicker positions when filler/panel moves

### 6. `useCabinetGroups`

- **Location**: `src/features/cabinets/ui/productPanel/hooks/useCabinetGroups.ts`
- **Purpose**: Manages **cabinet grouping and synchronization**.
- **Responsibilities**:
  - Tracks `groupCabinets` (paired cabinets with percentages)
  - Tracks `syncCabinets` (cabinets that sync dimensions)
  - Loads initial data when cabinet selection changes
  - Propagates changes to parent callbacks (`onGroupChange`, `onSyncChange`)

### 7. `useDimensionEvents`

- **Location**: `src/features/cabinets/ui/productPanel/hooks/useDimensionEvents.ts`
- **Purpose**: Handles **dimension change events** from external sources.
- **Responsibilities**:
  - Subscribes to `cabinet-dimensions-changed` events
  - Syncs external dimension changes back to panel state
  - Updates persisted state when dimensions change externally

### 8. `useDimensionSync`

- **Location**: `src/features/cabinets/ui/productPanel/hooks/useDimensionSync.ts`
- **Purpose**: Syncs **width changes** from 3D cabinet to panel.
- **Responsibilities**:
  - Monitors `cabinetWidth` prop changes
  - Finds the width dimension ID via GD mapping
  - Updates panel state and persistence when width changes externally

### 9. `useInitialization`

- **Location**: `src/features/cabinets/ui/productPanel/hooks/useInitialization.ts`
- **Purpose**: **One-time initialization** when cabinet is selected.
- **Responsibilities**:
  - Checks for persisted state and restores if available
  - Otherwise builds initial values from `wsProduct.dims`
  - Initializes material color from cabinet
  - Builds initial material selections from defaults
  - Applies initial dimensions to 3D scene
  - Syncs material selections to `PartDataManager`

### 10. `useMaterialSync`

- **Location**: `src/features/cabinets/ui/productPanel/hooks/useMaterialSync.ts`
- **Purpose**: Syncs **material selections** to part data manager.
- **Responsibilities**:
  - Monitors material selection changes
  - Updates `PartDataManager` with current selections
  - Ensures nesting/export has correct material info

---

## UI Components

These components render the panel sections.

### 1. `PanelHeader`

- **Location**: `src/features/cabinets/ui/productPanel/components/PanelHeader.tsx`
- **Purpose**: Header with title, price, and close button.
- **Props**: `wsProduct`, `sortNumber`, `loading`, `error`, `priceData`, `isPriceFetching`, `onClose`

### 2. `DimensionsSection`

- **Location**: `src/features/cabinets/ui/productPanel/components/DimensionsSection.tsx`
- **Purpose**: Renders all dimension controls.
- **Props**: `dimsList`, `values`, `editingValues`, `gdMapping`, `drawerQty`, `isModalFillerOrPanel`
- **Features**:
  - Shows badges for dimension types (Width, Height, Depth, Drawer H1, etc.)
  - Highlights dependent drawers (last drawer auto-calculates)
  - Disables height/depth for modal fillers/panels
  - Reset individual or all dimensions

### 3. `DimensionInput`

- **Location**: `src/features/cabinets/ui/productPanel/components/DimensionInput.tsx`
- **Purpose**: Single dimension input with slider/text modes.
- **Features**:
  - Range sliders with min/max bounds
  - Dropdown for option-based dimensions
  - Validation with error feedback
  - Editing buffer for intermediate values

### 4. `MaterialsSection`

- **Location**: `src/features/cabinets/ui/productPanel/components/MaterialsSection.tsx`
- **Purpose**: Lists all materials with selection controls.
- **Props**: `wsProduct`, `materialOptions`, `materialSelections`, `onSelectionChange`, `onOpenColorPicker`

### 5. `MaterialCard`

- **Location**: `src/features/cabinets/ui/productPanel/components/MaterialCard.tsx`
- **Purpose**: Single material selection card.
- **Features**: Shows current selection, opens color picker modal

### 6. `ColorPickerModal`

- **Location**: `src/features/cabinets/ui/productPanel/components/ColorPickerModal.tsx`
- **Purpose**: Full-screen material color/finish picker.
- **Props**: `materialId`, `material`, `materialOptions`, `currentSelection`, `onSelectionChange`, `onClose`

### 7. `SimpleColorPicker`

- **Location**: `src/features/cabinets/ui/productPanel/components/SimpleColorPicker.tsx`
- **Purpose**: Basic color picker for cabinet material color.
- **Props**: `color`, `onChange`

### 8. `PairSection`

- **Location**: `src/features/cabinets/ui/productPanel/components/PairSection.tsx`
- **Purpose**: UI for pairing cabinets with percentage distribution.
- **Props**: `selectedCabinet`, `cabinetsInView`, `allCabinets`, `groupCabinets`, `onGroupChange`

### 9. `SyncSection`

- **Location**: `src/features/cabinets/ui/productPanel/components/SyncSection.tsx`
- **Purpose**: UI for syncing cabinet dimensions.
- **Props**: `selectedCabinet`, `cabinetsInView`, `allCabinets`, `syncCabinets`, `onSyncChange`

### 10. `OffTheFloorControl`

- **Location**: `src/features/cabinets/ui/productPanel/components/OffTheFloorControl.tsx`
- **Purpose**: Slider for filler/panel Y position.
- **Props**: `value`, `editingValue`, `onValueChange`, `onEditingChange`

---

## Utilities

### 1. `dimensionUtils.ts`

- **Location**: `src/features/cabinets/ui/productPanel/utils/dimensionUtils.ts`
- **Key Functions**:
  - `toNum(v)`: Convert value to number
  - `buildDimsList(dims)`: Build sorted dimension entries
  - `clampValue(value, min, max)`: Clamp to bounds
  - `getDefaultDimValue(dimObj)`: Get default value
  - `validateDrawerHeightChange(...)`: Validate drawer height changes against dependent drawer
  - `extractPrimaryDimensions(...)`: Extract width/height/depth from values
  - `applyPrimaryDimsTo3D(...)`: Apply dimensions to 3D scene via callbacks
  - `syncCabinetDimensionsToValues(...)`: Sync 3D dimensions back to values

### 2. `materialUtils.ts`

- **Location**: `src/features/cabinets/ui/productPanel/utils/materialUtils.ts`
- **Key Exports**:
  - `MaterialSelections` type: Record of material ID to selection
  - Utility functions for material selection handling

### 3. `toastUtils.ts`

- **Location**: `src/features/cabinets/ui/productPanel/utils/toastUtils.ts`
- **Key Exports**:
  - `toastThrottled`: Throttled toast (1/sec) for validation errors during rapid slider movements

---

## Types

### Main Type Files:

1. **`productPanel.types.ts`**: Core types for the panel

   - `SelectedCabinetSnapshot`: Snapshot of selected cabinet state
   - `ProductPanelProps`: Main component props
   - `ProductPanelCallbacks`: All callback prop types
   - `DimensionRange`, `DimensionConstraints`: Dimension bounds

2. **`types/index.ts`**: Consolidated type re-exports
   - Re-exports hook types (`PersistedPanelState`, `PanelStateValues`, `GDMapping`, etc.)
   - Re-exports utility types (`MaterialSelections`, `DimEntry`, etc.)
   - `DynamicPanelProps`: Extended props for main panel component
   - `GroupCabinet`: Cabinet grouping data structure

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ProductPanel.tsx                            │
│                    (thin wrapper, re-exports)                       │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     DynamicPanelWithQuery                           │
│  - Fetches product data (React Query)                               │
│  - Syncs to PartDataManager                                         │
│  - Passes data to DynamicPanel                                      │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         DynamicPanel                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Hooks:                                                       │   │
│  │  - useGDMapping (GD ID → dimension type)                     │   │
│  │  - usePanelState (values, colors, selections)                │   │
│  │  - usePersistence (cross-session state)                      │   │
│  │  - useOffTheFloor (filler/panel Y position)                  │   │
│  │  - useCabinetGroups (pair/sync state)                        │   │
│  │  - usePriceQuery (real-time pricing)                         │   │
│  │  - useDimensionEvents (external change events)               │   │
│  │  - useDimensionSync (width sync from 3D)                     │   │
│  │  - useInitialization (setup on cabinet select)               │   │
│  │  - useMaterialSync (sync to PartDataManager)                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ UI Components:                                               │   │
│  │  - PanelHeader (title, price, close)                         │   │
│  │  - ViewSelector (assign to view)                             │   │
│  │  - PairSection (pair cabinets)                               │   │
│  │  - SyncSection (sync dimensions)                             │   │
│  │  - DimensionsSection (all dimension inputs)                  │   │
│  │  - OffTheFloorControl (Y position for fillers)               │   │
│  │  - MaterialsSection (material cards)                         │   │
│  │  - SimpleColorPicker (cabinet color)                         │   │
│  │  - ColorPickerModal (full material picker)                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    External Systems                                 │
│  - 3D Scene (via callbacks: onDimensionsChange, etc.)               │
│  - PartDataManager (for nesting/export)                             │
│  - ViewManager (cabinet grouping)                                   │
│  - Event Bus (dimension change events)                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/features/cabinets/ui/
├── ProductPanel.tsx              (~45 lines - thin wrapper)
├── productPanel.types.ts         (core type definitions)
├── productPanel/
│   ├── index.ts                  (barrel exports)
│   ├── DynamicPanelWithQuery.tsx (~110 lines - data fetching)
│   ├── DynamicPanel.tsx          (~600 lines - main component)
│   ├── types/
│   │   └── index.ts              (consolidated types)
│   ├── hooks/
│   │   ├── index.ts              (barrel exports)
│   │   ├── useGDMapping.ts       (~100 lines)
│   │   ├── usePanelState.ts      (~180 lines)
│   │   ├── usePersistence.ts     (~210 lines)
│   │   ├── usePriceQuery.ts      (~145 lines)
│   │   ├── useOffTheFloor.ts     (~100 lines)
│   │   ├── useCabinetGroups.ts   (~85 lines)
│   │   ├── useDimensionEvents.ts
│   │   ├── useDimensionSync.ts
│   │   ├── useInitialization.ts
│   │   └── useMaterialSync.ts
│   ├── components/
│   │   ├── index.ts              (barrel exports)
│   │   ├── PanelHeader.tsx
│   │   ├── DimensionsSection.tsx
│   │   ├── DimensionInput.tsx
│   │   ├── MaterialsSection.tsx
│   │   ├── MaterialCard.tsx
│   │   ├── ColorPickerModal.tsx
│   │   ├── SimpleColorPicker.tsx
│   │   ├── PairSection.tsx
│   │   ├── SyncSection.tsx
│   │   └── OffTheFloorControl.tsx
│   └── utils/
│       ├── index.ts              (barrel exports)
│       ├── dimensionUtils.ts     (~280 lines)
│       ├── materialUtils.ts
│       └── toastUtils.ts         (~15 lines)
```

---

## Common Modification Patterns

### Adding a New Dimension Type

1. Add GD ID mapping in `useGDMapping.ts` (e.g., `newTypeGDIds`)
2. Add extraction logic in `dimensionUtils.ts` → `extractPrimaryDimensions`
3. Add apply logic in `dimensionUtils.ts` → `applyDimensionsTo3D`
4. Add badge in `useGDMapping.ts` → `getDimensionBadges`

### Adding a New UI Section

1. Create component in `components/` folder
2. Export from `components/index.ts`
3. Import and render in `DynamicPanel.tsx`
4. Add any required state to `usePanelState` or create new hook

### Adding a New Hook

1. Create hook file in `hooks/` folder
2. Export from `hooks/index.ts`
3. Import and use in `DynamicPanel.tsx`
4. Document in this guide

### Modifying Price Calculation Inputs

1. Update `usePriceQuery.ts` options
2. Ensure inputs are included in debounced values from `usePanelState.ts`
3. Update API call in `calculateWsProductPrice.ts` if needed
