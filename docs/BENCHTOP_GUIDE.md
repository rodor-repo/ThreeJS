# Benchtop Guide: Creation, Management, and Logic

This guide provides a detailed overview of how benchtops are handled in the `ThreeScene` codebase. Benchtops are specialized cabinet entities that are typically attached to base cabinets but can also exist independently.

## Overview

Benchtops in this application are not just simple meshes; they are full `CabinetData` objects with a `cabinetType` of `"benchtop"`. They are managed by a set of dedicated handlers that ensure they stay synchronized with their parent cabinets and any adjacent fillers or panels.

---

## 1. Creation Flow

The creation of a benchtop is usually triggered from the UI (e.g., a toggle in the `CabinetLockIcons` or `ProductPanel`).

### Entry Point: `handleBenchtopSelect`

- **Location**: `src/features/scene/utils/handlers/benchtopHandler.ts`
- **Process**:
  1. **Validation**: Ensures the target cabinet is a "base" cabinet.
  2. **Product Selection**: Finds a default benchtop product from `wsProducts` if none is provided.
  3. **Effective Dimensions**: Calls `getEffectiveBenchtopDimensions` (from `benchtopUtils.ts`) to calculate the total length. This includes the parent cabinet's width plus the widths of any child fillers or panels attached to it.
  4. **Factory Call**: Uses the standard `createCabinet` function (which uses `cabinetFactory`) to instantiate a new cabinet of type `"benchtop"`.
  5. **Linking**: Sets `benchtopParentCabinetId` on the new benchtop to link it to the base cabinet.
  6. **Initial Positioning**: Places the benchtop at the top-left-back corner of the parent cabinet.

---

## 2. Management & Toggling

### Toggling Benchtops

- **Handler**: `handleBenchtopToggle` in `benchtopHandler.ts`.
- **Logic**: If enabled is false, it finds the benchtop linked to the cabinet and deletes it using `deleteCabinet`.

### Deletion

- When a parent base cabinet is deleted, its linked benchtop should also be cleaned up (handled by general cabinet deletion logic or specific handlers).

---

## 3. Positioning & Resizing

Benchtops must dynamically update whenever their parent or "sibling" children (fillers/panels) change.

### The Position Handler: `updateBenchtopPosition`

- **Location**: `src/features/scene/utils/handlers/benchtopPositionHandler.ts`
- **Responsibilities**:
  - **Syncing Dimensions**: Recalculates the `effectiveLength` and `effectiveLeftX` whenever the parent cabinet is moved or resized.
  - **Overhangs**: Applies `benchtopFrontOverhang`, `benchtopLeftOverhang`, and `benchtopRightOverhang` from the benchtop's config.
  - **Carcass Update**: Calls `carcass.updateDimensions()` on the benchtop cabinet, which triggers the `BenchtopBuilder`.
  - **World Position**: Updates the `group.position` of the benchtop to stay on top of the parent.

### Centralized Updates: `updateAllDependentComponents`

- **Location**: `src/features/scene/utils/handlers/dependentComponentsHandler.ts`
- **Role**: This is the primary orchestrator for all component updates. When a cabinet is modified, this function ensures that its children (fillers/panels), kicker, bulkhead, underpanel, and **benchtop** are all updated in the correct order.
- **Child-to-Parent Trigger**: It also handles "upward" updates. If a child filler or panel is resized, it identifies the parent cabinet and triggers an update for the parent's benchtop and kicker.

### Trigger Points

`updateBenchtopPosition` is primarily called via `updateAllDependentComponents` in:

- **`useSceneInteractions.ts`**: During cabinet dragging.
- **`fillerHandler.ts`**: When fillers/panels are added or removed from the parent.
- **`deleteCabinetHandler.ts`**: When a cabinet (parent or child) is deleted.
- **`productDimensionHandler.ts`**: When cabinet dimensions are changed via the UI.
- **`BenchtopPanel.tsx`**: When benchtop-specific properties (like thickness) are edited.
- **`ThreeScene.tsx`**: During batch dimension changes (e.g., view-wide updates).

---

## 4. Parent-Child Relationships

Benchtops have a complex relationship with other cabinets:

1.  **Parent (Base Cabinet)**: The benchtop "belongs" to a base cabinet. It follows its position and uses its depth as a baseline.
2.  **Siblings (Fillers & Panels)**: If a base cabinet has fillers or panels attached (also as children), the benchtop automatically expands to cover them.
3.  **Upward Updates**: When a child filler or panel is resized, it triggers an update on the parent cabinet's benchtop. This ensures the benchtop always matches the combined width of the cabinet and its fillers.
4.  **View Integration**: Benchtops are assigned to the same `viewId` as their parent, ensuring they are grouped correctly in the `ViewManager`.

---

## 5. 3D Representation & Carcass Logic

### `Benchtop` Part

- **Location**: `src/features/carcass/parts/Benchtop.ts`
- **Logic**: A simple `THREE.BoxGeometry`. It handles the geometry generation and positioning relative to its own group origin. It accounts for left/right overhangs by shifting the mesh.

### `BenchtopBuilder`

- **Location**: `src/features/carcass/builders/SimplePanelBuilder.ts`
- **Logic**: Implements the `CabinetBuilder` interface. It maps `CarcassDimensions` to the `Benchtop` part:
  - `width` -> Length (X)
  - `height` -> Thickness (Y)
  - `depth` -> Total Depth (Z, including front overhang)

### `CarcassAssembly`

- The `CarcassAssembly` for a benchtop cabinet holds the `_benchtop` instance and provides methods like `updateBenchtopOverhangs`.

---

## 6. UI Components

### `BenchtopPanel`

- **Location**: `src/features/scene/ui/BenchtopPanel.tsx`
- **Purpose**: A specialized side panel (similar to `ProductPanel`) for editing benchtop properties.
- **Features**:
  - Displays current Length and Depth.
  - Allows editing **Thickness**.
  - Shows position and parent association.

### `CabinetLockIcons`

- **Location**: `src/features/scene/ui/CabinetLockIcons.tsx`
- **Purpose**: Provides the "Add Benchtop" toggle when a base cabinet is double-clicked.

---

## Key Files Reference

| File                                                              | Role                                                |
| :---------------------------------------------------------------- | :-------------------------------------------------- |
| `src/features/scene/utils/handlers/benchtopHandler.ts`            | Creation and toggling logic.                        |
| `src/features/scene/utils/handlers/benchtopPositionHandler.ts`    | Dynamic syncing of position and size.               |
| `src/features/scene/utils/handlers/dependentComponentsHandler.ts` | Centralized orchestrator for all component updates. |
| `src/features/scene/utils/benchtopUtils.ts`                       | Shared calculations (effective length, depth).      |
| `src/features/carcass/builders/builder-constants.ts`              | Centralized constants (thickness, overhangs).       |
| `src/features/carcass/parts/Benchtop.ts`                          | 3D Geometry and mesh logic.                         |
| `src/features/carcass/builders/SimplePanelBuilder.ts`             | Carcass assembly integration (`BenchtopBuilder`).   |
| `src/features/scene/ui/BenchtopPanel.tsx`                         | UI for editing benchtop properties.                 |
| `src/features/scene/ThreeScene.tsx`                               | Wiring of handlers and UI overlays.                 |
| `src/features/scene/types.ts`                                     | Type definitions (`CabinetData` properties).        |
