# Adding New Cabinet Types: Complete Guide

This document lists all files that need to be reviewed and potentially modified when adding a new type of cabinet (or child cabinet) to the 3D scene. The files are organized by category, with explanations of each file's role in cabinet creation and handling.

---

## Table of Contents

1. [Quick Reference Checklist](#quick-reference-checklist)
2. [Core Factory & Types](#1-core-factory--types)
3. [Carcass Building System](#2-carcass-building-system)
4. [Scene Handlers](#3-scene-handlers)
5. [Hooks (State Management)](#4-hooks-state-management)
6. [UI Components](#5-ui-components)
7. [Part Data & Persistence](#6-part-data--persistence)

---

## Quick Reference Checklist

**Must modify for ANY new cabinet type:**

- [ ] `src/features/scene/types.ts` - Add to `CabinetType` union
- [ ] `src/features/cabinets/factory/cabinetFactory.ts` - Add default dimensions & config
- [ ] `src/features/carcass/CarcassAssembly.ts` - Add builder selection logic
- [ ] `src/features/carcass/builders/` - Create or modify builder
- [ ] `src/components/categoriesData.ts` - Add menu entry

**Likely need modification:**

- [ ] `src/features/carcass/builders/builder-constants.ts` - Add type-specific constants
- [ ] `src/features/scene/utils/handlers/productDimensionHandler.ts` - Dimension change logic
- [ ] `src/features/cabinets/hooks/useCabinets.ts` - Cabinet state management
- [ ] `src/nesting/PartDataManager.ts` - Part extraction for nesting

**For child cabinet types (fillers, panels, kickers, bulkheads, under-panels):**

- [ ] Relevant handler file in `src/features/scene/utils/handlers/`
- [ ] UI modal in `src/features/scene/ui/`
- [ ] `CabinetData` interface (add parent relationship fields)

---

## 1. Core Factory & Types

### [src/features/scene/types.ts](../src/features/scene/types.ts)

**Role:** Defines the `CabinetType` union type and `CabinetData` interface.

**What to modify when adding a new cabinet type:**

1. **Add to `CabinetType` union:**

```typescript
export type CabinetType =
  | "base"
  | "top"
  | "tall"
  | "panel"
  | "filler"
  | "wardrobe"
  | "kicker"
  | "bulkhead"
  | "benchtop"
  | "underPanel"
  | "yourNewType" // <-- Add new type here
```

2. **Add parent relationship fields if it's a child cabinet:**

```typescript
export type CabinetData = {
  // ... existing fields
  /** For yourNewType: parent cabinet ID */
  yourNewTypeParentCabinetId?: string
}
```

---

### [src/features/cabinets/factory/cabinetFactory.ts](../src/features/cabinets/factory/cabinetFactory.ts)

**Role:** Main factory for creating cabinet instances. Contains default dimensions, default configurations, and the `createCabinet` function.

**What to modify when adding a new cabinet type:**

1. **Add default dimensions in `defaultDimensions` object:**

```typescript
const defaultDimensions: Defaults = {
  // ... existing types
  yourNewType: { width: 600, height: 720, depth: 600 },
}
```

2. **Add configuration in `getDefaultConfig` function:**

```typescript
const getDefaultConfig = (
  type: CabinetType,
  subcategoryId: string,
  opts?
): Partial<CarcassConfig> => {
  switch (type) {
    // ... existing cases
    case "yourNewType":
      return {
        shelfCount: 2,
        shelfSpacing: 300,
        // Add type-specific config
      }
  }
}
```

3. **Handle special dimension logic in `createCabinet` if needed**

---

### [src/features/cabinets/adapters/cabinet-adapter.ts](../src/features/cabinets/adapters/cabinet-adapter.ts)

**Role:** Adapter functions that wrap `CarcassAssembly` methods for common operations like dimension updates, material changes, door/drawer toggling, and kicker height adjustments.

**What to modify when adding a new cabinet type:**

- If your new cabinet type has unique operations not covered by existing adapters, add new adapter functions here
- Example: If the new type has a unique component like "sliding doors", add `toggleSlidingDoors(c: CarcassAssembly, enabled: boolean)`

**Existing adapter functions:**

- `applyDimensions` - Update width/height/depth
- `applyMaterialProps` - Update material properties
- `applyKicker` - Update kicker height
- `toggleDoors` / `setDoorMaterial` / `setDoorCount` / `setOverhang` - Door operations
- `toggleDrawers` / `setDrawerQty` / `setDrawerHeight` / `balanceDrawerHeights` - Drawer operations

---

## 2. Carcass Building System

The carcass building system is responsible for constructing the 3D geometry of cabinets. It uses a **Builder Pattern** where each cabinet type has a dedicated builder class.

### [src/features/carcass/CarcassAssembly.ts](../src/features/carcass/CarcassAssembly.ts)

**Role:** Main assembly class that orchestrates cabinet construction. Acts as the central controller for the 3D model.

**Key interfaces defined here:**

- `CarcassDimensions` - `{ width, height, depth }`
- `CarcassConfig` - Configuration including material, shelves, doors, drawers, filler type, etc.

**What to modify when adding a new cabinet type:**

1. **Add part references if the new type has unique parts:**

```typescript
// Panel and filler specific parts
public panel?: CarcassPanel
public frontPanel?: CarcassFront
public fillerReturn?: CarcassPanel
// Add your new type's unique parts here
public yourNewPartType?: YourNewPart
```

2. **Add getter for new parts:**

```typescript
public get yourNewPart(): YourNewPart | undefined {
  return this._yourNewPart
}
```

3. **Update `dispose()` method to clean up new parts:**

```typescript
public dispose(): void {
  // ... existing dispose logic
  if (this._yourNewPart) { this._yourNewPart.dispose(); this._yourNewPart = undefined }
}
```

4. **Add type-specific methods if needed** (like `addBulkheadReturn` for bulkheads)

---

### [src/features/carcass/builders/index.ts](../src/features/carcass/builders/index.ts)

**Role:** Builder registry that maps cabinet types to their builder classes.

**What to modify when adding a new cabinet type:**

1. **Import your new builder:**

```typescript
import { YourNewBuilder } from "./YourNewBuilder"
```

2. **Add case in `BuilderRegistry.getBuilder()`:**

```typescript
export class BuilderRegistry {
  static getBuilder(type: CabinetType): CabinetBuilder {
    switch (type) {
      // ... existing cases
      case "yourNewType":
        return new YourNewBuilder()
    }
  }
}
```

---

### [src/features/carcass/builders/CabinetBuilder.ts](../src/features/carcass/builders/CabinetBuilder.ts)

**Role:** Interface definition for all cabinet builders.

**Interface requirements:**

```typescript
export interface CabinetBuilder {
  build(assembly: CarcassAssembly): void // Create initial geometry
  updateDimensions(assembly: CarcassAssembly): void // Update when dimensions change
  getPartDimensions(assembly: CarcassAssembly): PartDimension[] // Export part data
}
```

**When adding a new cabinet type:** Create a new builder class implementing this interface.

---

### Builder Examples by Cabinet Category

| Cabinet Type                      | Builder Class               | Description                                                              |
| --------------------------------- | --------------------------- | ------------------------------------------------------------------------ |
| `base`, `top`, `tall`, `wardrobe` | `TraditionalCabinetBuilder` | Full cabinet with ends, back, bottom, top, shelves, doors, drawers, legs |
| `panel`                           | `PanelCabinetBuilder`       | Single vertical panel (YZ plane)                                         |
| `filler`                          | `FillerCabinetBuilder`      | Linear or L-shape filler panels                                          |
| `kicker`                          | `KickerBuilder`             | Horizontal panel at cabinet base                                         |
| `bulkhead`                        | `BulkheadBuilder`           | Panel above cabinet to ceiling                                           |
| `underPanel`                      | `UnderPanelBuilder`         | Panel under top cabinets                                                 |

---

### [src/features/carcass/builders/TraditionalCabinetBuilder.ts](../src/features/carcass/builders/TraditionalCabinetBuilder.ts)

**Role:** Builder for standard cabinet types (base, top, tall, wardrobe). Creates full carcass with all parts.

**Key methods:**

- `build()` - Creates end panels, back, bottom, top, shelves, legs, doors, drawers
- `updateDimensions()` - Updates all parts when dimensions change
- `getPartDimensions()` - Returns dimensions for nesting/export

**Use as reference when:** Creating a new "full cabinet" type that needs multiple structural parts.

---

### [src/features/carcass/builders/SimplePanelBuilder.ts](../src/features/carcass/builders/SimplePanelBuilder.ts)

**Role:** Contains builders for simple panel-based cabinets (Kicker, UnderPanel, Bulkhead).

**Use as reference when:** Creating a new "accessory" type that's essentially a single panel attached to another cabinet.

---

### [src/features/carcass/builders/builder-constants.ts](../src/features/carcass/builders/builder-constants.ts)

**Role:** Centralized constants for cabinet dimensions and part naming.

**What to modify when adding a new cabinet type:**

```typescript
// Add type-specific constants
export const YOUR_TYPE_DEFAULT_VALUE = 100 // mm

// Add part names for export
export const PART_NAMES = {
  // ... existing names
  YOUR_NEW_PART: "Your New Part",
} as const
```

---

### Parts Directory: [src/features/carcass/parts/](../src/features/carcass/parts/)

**Role:** Individual 3D part components (Three.js meshes).

| Part File           | Description                    |
| ------------------- | ------------------------------ |
| `CarcassEnd.ts`     | Left/Right end panels          |
| `CarcassBack.ts`    | Back panel                     |
| `CarcassBottom.ts`  | Bottom panel                   |
| `CarcassTop.ts`     | Top panel / Base rail          |
| `CarcassShelf.ts`   | Adjustable shelves             |
| `CarcassDoor.ts`    | Cabinet doors                  |
| `CarcassDrawer.ts`  | Drawer fronts                  |
| `CarcassLeg.ts`     | Cabinet legs                   |
| `CarcassPanel.ts`   | Generic vertical panel (YZ)    |
| `CarcassFront.ts`   | Front-facing panel (XY)        |
| `KickerFace.ts`     | Kicker panel                   |
| `BulkheadFace.ts`   | Bulkhead panel                 |
| `BulkheadReturn.ts` | Bulkhead side returns          |
| `UnderPanelFace.ts` | Under-panel below top cabinets |

**When adding a new cabinet type with unique geometry:** Create a new part class following the existing patterns.

---

### Managers: [src/features/carcass/managers/](../src/features/carcass/managers/)

**Role:** Handle complex component logic (doors, drawers).

- `CarcassDoorManager.ts` - Door creation, updating, toggling
- `CarcassDrawerManager.ts` - Drawer creation, height management

**When adding a new cabinet type:** If it has doors/drawers, these managers handle the logic automatically through the builder.

---

## 3. Scene Handlers

Handlers contain business logic for cabinet operations like dimension changes, repositioning, and deletion. Located in `src/features/scene/utils/handlers/`.

### [productDimensionHandler.ts](../src/features/scene/utils/handlers/productDimensionHandler.ts)

**Role:** Handles dimension changes for individual cabinets. The main entry point for resize operations.

**Key function:** `handleProductDimensionChange()`

**What to modify when adding a new cabinet type:**

- If the new type has special resize behavior, add a case in the handler
- If the new type has child components, ensure `updateAllDependentComponents` handles it

**Important patterns to follow:**

```typescript
// Validate constraints before applying changes
const constraints = getWidthConstraints(cabinet.productId)
if (constraints) { /* validate min/max */ }

// Apply lock behavior
const lockResult = applyWidthChangeWithLock(selectedCabinet, ...)

// Update all dependent components after resize
updateAllDependentComponents(cabinet, cabinets, wallDimensions, {
  heightChanged, widthChanged, depthChanged, positionChanged
})
```

---

### [childCabinetHandler.ts](../src/features/scene/utils/handlers/childCabinetHandler.ts)

**Role:** Updates child cabinets (fillers/panels) when parent cabinet changes.

**Key function:** `updateChildCabinets()`

**What to modify when adding a new cabinet type:**

- If the new type can have children (like fillers attached), add logic here
- If the new type IS a child type, ensure it's handled in the filter:

```typescript
const childCabinets = cabinets.filter(
  (c) =>
    c.parentCabinetId === parentCabinet.cabinetId &&
    (c.cabinetType === "filler" ||
      c.cabinetType === "panel" ||
      c.cabinetType === "yourNewChildType")
)
```

---

### [dependentComponentsHandler.ts](../src/features/scene/utils/handlers/dependentComponentsHandler.ts)

**Role:** Centralized function to update all dependent components (children, kicker, bulkhead, underPanel).

**Key function:** `updateAllDependentComponents()`

**What to modify when adding a new cabinet type:**

```typescript
// Add handling for your new type's dependent components
if (cabinet.cabinetType === "yourNewType") {
  updateYourNewComponentPosition(cabinet, allCabinets, {
    dimensionsChanged:
      changes.heightChanged || changes.widthChanged || changes.depthChanged,
    positionChanged: changes.positionChanged || false,
  })
}
```

---

### [deleteCabinetHandler.ts](../src/features/scene/utils/handlers/deleteCabinetHandler.ts)

**Role:** Handles cabinet deletion, including cleanup of view assignments and group relationships.

**Key function:** `handleDeleteCabinet()`

**What to modify when adding a new cabinet type:**

- If the new type has parent relationships that need cleanup, add logic similar to:

```typescript
if (
  cabinetToDelete.cabinetType === "yourNewType" &&
  cabinetToDelete.parentCabinetId
) {
  const parentCabinet = allCabinets.find(
    (c) => c.cabinetId === cabinetToDelete.parentCabinetId
  )
  // Handle parent cleanup
}
```

---

### [fillerHandler.ts](../src/features/scene/utils/handlers/fillerHandler.ts)

**Role:** Creates and removes filler/panel child cabinets attached to parent cabinets.

**Key functions:**

- `handleFillerSelect()` - Creates a new filler/panel
- `handleFillerToggle()` - Removes an existing filler/panel

**Use as reference when:** Creating a new child cabinet type that attaches to parent cabinets.

**Pattern to follow:**

1. Find parent cabinet
2. Create new cabinet with `createCabinet()`
3. Set dimensions based on parent
4. Position relative to parent
5. Set parent-child relationship fields
6. Add to same view as parent
7. Set appropriate lock states

---

### Additional Handlers (for specific component types)

| Handler File                   | Description                       | When to Reference                       |
| ------------------------------ | --------------------------------- | --------------------------------------- |
| `bulkheadHandler.ts`           | Bulkhead creation/removal         | Adding overhead components              |
| `bulkheadPositionHandler.ts`   | Bulkhead positioning              | Adding positioned components            |
| `kickerHandler.ts`             | Kicker creation/removal           | Adding base attachments                 |
| `kickerPositionHandler.ts`     | Kicker positioning                | Adding floor-level components           |
| `underPanelHandler.ts`         | Under-panel creation/removal      | Adding under-cabinet components         |
| `underPanelPositionHandler.ts` | Under-panel positioning           | Adding components below cabinets        |
| `viewDimensionHandler.ts`      | Batch dimension updates for views | Supporting view-wide operations         |
| `viewRepositionHandler.ts`     | Repositioning cabinets in views   | Supporting cabinet push/shift           |
| `lockBehaviorHandler.ts`       | Lock state resize logic           | Supporting locked edge behavior         |
| `splashbackHandler.ts`         | Splashback height changes         | Adding vertical gap components          |
| `sharedCabinetUtils.ts`        | Shared utility functions          | Common helpers like `areCabinetsPaired` |

---

## 4. Hooks (State Management)

### [src/features/cabinets/hooks/useCabinets.ts](../src/features/cabinets/hooks/useCabinets.ts)

**Role:** Main hook managing cabinet state, creation, selection, and deletion.

**Key functions:**

- `createCabinet()` - Creates a new cabinet and adds to scene
- `deleteCabinet()` - Removes cabinet from scene with cleanup
- `clearCabinets()` - Removes all cabinets
- `updateCabinetViewId()` - Updates view assignment (includes child components)
- `updateCabinetLock()` - Updates lock states

**What to modify when adding a new cabinet type:**

1. **Update `updateCabinetViewId` if the new type has parent-child relationships:**

```typescript
// Find all yourNewType that belong to this parent
const yourNewTypeCabinetIds = prev
  .filter(
    (cab) =>
      cab.yourNewTypeParentCabinetId === cabinetId &&
      cab.cabinetType === "yourNewType"
  )
  .map((cab) => cab.cabinetId)
```

2. **Handle cleanup in `deleteCabinet` if needed**

---

### [src/features/scene/hooks/useProductDrivenCreation.ts](../src/features/scene/hooks/useProductDrivenCreation.ts)

**Role:** Watches for product selection in UI and triggers cabinet creation.

**Key mapping:** `legacyCategoryMap` maps design `type3D` to `CabinetType`:

```typescript
const legacyCategoryMap: Record<type3D, CabinetType> = {
  base: "base",
  overhead: "top",
  tall: "tall",
  panel: "panel",
  filler: "filler",
  wardrobe: "wardrobe",
  bulkhead: "bulkhead",
  kicker: "kicker",
  benchtop: "benchtop",
  underPanel: "underPanel",
  // yourNewType: "yourNewType",  // <-- Add mapping here
}
```

**What to modify when adding a new cabinet type:**

- Add the mapping from the ERP's `type3D` value to your new `CabinetType`

---

### [src/features/scene/hooks/useRoomPersistence.ts](../src/features/scene/hooks/useRoomPersistence.ts)

**Role:** Handles save/load room functionality.

**Delegates to:** `roomPersistenceUtils.ts` for serialization/deserialization logic.

---

### [src/features/scene/utils/roomPersistenceUtils.ts](../src/features/scene/utils/roomPersistenceUtils.ts)

**Role:** Serializes room state to JSON and restores from saved rooms.

**Key functions:**

- `serializeRoom()` - Converts current state to SavedRoom format
- `restoreRoom()` - Loads a SavedRoom and recreates all cabinets

**What to modify when adding a new cabinet type:**

1. **In `serializeRoom`, save any new parent relationship fields:**

```typescript
return {
  // ... existing fields
  yourNewTypeParentCabinetId: cabinet.yourNewTypeParentCabinetId,
}
```

2. **In `restoreRoom`, restore the new relationships:**

```typescript
// Map yourNewTypeParentCabinetId
if (savedCabinet.yourNewTypeParentCabinetId) {
  const newParentId = oldIdToNewId.get(savedCabinet.yourNewTypeParentCabinetId)
  if (newParentId) {
    cabinetData.yourNewTypeParentCabinetId = newParentId
  }
}
```

---

### Other Important Hooks

| Hook File                 | Description             | When to Review                            |
| ------------------------- | ----------------------- | ----------------------------------------- |
| `useViewManager.ts`       | Manages view groupings  | If new type needs view assignments        |
| `useSceneInteractions.ts` | Mouse events, dragging  | If new type has special interaction needs |
| `useDimensionLines.ts`    | Dimension visualization | If new type needs dimension display       |
| `useCabinetNumbers.ts`    | Cabinet numbering       | If new type should show numbers           |

---

## 5. UI Components

### [src/components/categoriesData.ts](../src/components/categoriesData.ts)

**Role:** Defines menu categories and subcategories for cabinet selection UI.

**Note:** This file appears to be mostly commented out, with cabinet data likely coming from `wsProducts` API. However, the interfaces are important:

```typescript
export interface Subcategory {
  id: string
  name: string
  dimensions: {
    height: { min: number; max: number; default: number }
    width: { min: number; max: number; default: number }
    depth: { min: number; max: number; default: number }
  }
}

export interface Category {
  id: string
  name: string
  description: string
  icon: string
  color: string
  subcategories: Subcategory[]
}
```

**What to modify when adding a new cabinet type:**

- If using local categories (uncommented), add a new category entry
- If using API data, ensure the API's `designs` table has the new `type3D` value

---

### [src/features/cabinets/ui/productPanel/DynamicPanel.tsx](../src/features/cabinets/ui/productPanel/DynamicPanel.tsx)

**Role:** Main panel for editing cabinet properties (dimensions, materials, doors, drawers).

**Key features:**

- Uses hooks for state management (useGDMapping, usePanelState, etc.)
- Renders DimensionsSection, MaterialsSection, ViewSelector, etc.
- Handles off-the-floor positioning for fillers/panels

**What to modify when adding a new cabinet type:**

1. **Add special UI controls if needed:**

```typescript
// Example: Add a section for your new type's specific controls
{selectedCabinet?.cabinetType === "yourNewType" && (
  <YourNewTypeControls
    value={...}
    onChange={...}
  />
)}
```

2. **Handle special behavior in the "Off the Floor" section if applicable:**

```typescript
{(selectedCabinet?.cabinetType === "filler" ||
  selectedCabinet?.cabinetType === "panel" ||
  selectedCabinet?.cabinetType === "yourNewType") && (
  <OffTheFloorControl ... />
)}
```

---

### Scene UI Components ([src/features/scene/ui/](../src/features/scene/ui/))

**Modals for child cabinet types:**

| Component              | Description                   | When to Create                          |
| ---------------------- | ----------------------------- | --------------------------------------- |
| `FillersModal.tsx`     | Select filler/panel to attach | Reference for child attachment UI       |
| `BulkheadsModal.tsx`   | Bulkhead options              | Reference for overhead attachments      |
| `KickersModal.tsx`     | Kicker options                | Reference for base attachments          |
| `UnderPanelsModal.tsx` | Under-panel options           | Reference for under-cabinet attachments |

**When adding a new child cabinet type:**

1. Create a new modal component following the existing patterns
2. Add the modal to ThreeScene.tsx
3. Wire up to the appropriate handler

---

## 6. Part Data & Persistence

### [src/nesting/PartDataManager.ts](../src/nesting/PartDataManager.ts)

**Role:** Maintains a database of all part dimensions for nesting/export functionality.

**Key interfaces:**

```typescript
export interface PartData {
  partId: string
  cabinetId: string
  cabinetType: string
  cabinetNumber?: number
  cabinetName: string
  partName: string
  dimX: number
  dimY: number
  dimZ: number
  materialId: string
  materialName: string
  materialColor: string
  lastUpdated: number
}
```

**What to modify when adding a new cabinet type:**

1. **Update `formatCabinetName` mapping:**

```typescript
private formatCabinetName(cabinetType: string): string {
  const typeMap: Record<string, string> = {
    base: 'Base Cabinet',
    top: 'Overhead Cabinet',
    tall: 'Tall Cabinet',
    // ... existing types
    yourNewType: 'Your New Type Cabinet',  // <-- Add mapping
  }
}
```

2. **Handle special material logic in `updateCabinetParts` if needed:**

```typescript
// If your new type has special material handling
const isYourNewType = partDim.partName.includes("YourNewPart")
if (isYourNewType) {
  // Special material logic
}
```

---

### [src/nesting/usePartData.ts](../src/nesting/usePartData.ts)

**Role:** React hook that syncs cabinet changes to PartDataManager.

**Typically no modification needed** for new cabinet types since it calls `getPartDimensions()` from the builder.

---

### [src/data/savedRooms.ts](../src/data/savedRooms.ts)

**Role:** Type definitions for saved room data.

**What to modify when adding a new cabinet type:**

1. **Update `SavedCabinet` interface if needed:**

```typescript
export interface SavedCabinet {
  // ... existing fields
  yourNewTypeParentCabinetId?: string // <-- Add if child type
}
```

---

## Summary: Checklist by Cabinet Category

### For a new "Main Cabinet" type (like base, top, tall):

1. [ ] Add to `CabinetType` union in `types.ts`
2. [ ] Add default dimensions in `cabinetFactory.ts`
3. [ ] Add config in `getDefaultConfig` in `cabinetFactory.ts`
4. [ ] Create or modify builder in `src/features/carcass/builders/`
5. [ ] Register builder in `BuilderRegistry` in `builders/index.ts`
6. [ ] Add mapping in `useProductDrivenCreation.ts`
7. [ ] Update `dependentComponentsHandler.ts` for dependent components
8. [ ] Add to `formatCabinetName` in `PartDataManager.ts`

### For a new "Child/Accessory" type (like filler, kicker, bulkhead):

All of the above, PLUS:

1. [ ] Add parent relationship field to `CabinetData` interface
2. [ ] Create handler file (e.g., `yourNewTypeHandler.ts`)
3. [ ] Create position handler file (e.g., `yourNewTypePositionHandler.ts`)
4. [ ] Create UI modal (e.g., `YourNewTypeModal.tsx`)
5. [ ] Update `updateCabinetViewId` in `useCabinets.ts`
6. [ ] Update `roomPersistenceUtils.ts` for serialization
7. [ ] Add to `updateAllDependentComponents` handler

---

## Related Documentation

- [AI_CODING_ASSISTANT_GUIDE.md](./AI_CODING_ASSISTANT_GUIDE.md) - Overview of ThreeScene architecture
- [CABINET_RELATIONS_GUIDE.md](./CABINET_RELATIONS_GUIDE.md) - Cabinet relationships and grouping
