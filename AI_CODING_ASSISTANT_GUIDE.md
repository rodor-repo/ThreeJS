# AI Coding Assistant Guide: ThreeScene Codebase

This guide provides a high-level overview of the `ThreeScene` component and its dependencies. It is designed to help AI assistants and developers understand the architecture, key components, and data flow within the 3D scene module.

## Entry Point: `src/features/scene/ThreeScene.tsx`

`ThreeScene.tsx` is the main container for the 3D visualization. It does not implement low-level logic directly but rather composes various **custom hooks** to manage different aspects of the scene.

### Key Responsibilities:

- Initializing the 3D environment.
- Managing application state (modes, visibility settings).
- Composing hooks for renderer, cabinets, interactions, and UI.
- Rendering the main UI overlays (settings, product panel, camera controls).

---

## Core Hooks (State & Rendering)

These hooks form the backbone of the 3D scene.

### 1. `useThreeRenderer`

- **Location**: `src/features/scene/hooks/useThreeRenderer.ts`
- **Purpose**: Manages the **Three.js lifecycle**.
- **Responsibilities**:
  - Creates the `THREE.Scene`, `THREE.PerspectiveCamera`, and `THREE.WebGLRenderer`.
  - Sets up lighting (ambient, directional) and helpers (grid, axes).
  - **Wall & Floor Generation**: Creates and updates the geometry for walls (back, left, right, additional) and the floor based on `WallDimensions`.
  - Handles window resize events.

### 2. `useCabinets`

- **Location**: `src/features/cabinets/hooks/useCabinets.ts`
- **Purpose**: Manages the **Cabinet entities**.
- **Responsibilities**:
  - Maintains the state of all `cabinets` (array of `CabinetData`).
  - Handles **Creation**: Uses `cabinetFactory` to instantiate new cabinet objects.
  - Handles **Deletion**: Removes cabinets from the scene and disposes of their resources.
  - Handles **Selection**: Manages `selectedCabinets` state and applies highlight effects.
  - Manages cabinet properties like `viewId`, locks, and hover effects.

### 3. `useSceneInteractions`

- **Location**: `src/features/scene/hooks/useSceneInteractions.ts`
- **Purpose**: Handles **User Input & Physics**.
- **Responsibilities**:
  - **Mouse Events**: Listens for click, drag, and hover events on the canvas.
  - **Cabinet Movement**: Implements logic for dragging cabinets, including **boundary clamping** (keeping cabinets inside walls) and **collision detection**.
  - **Snapping**: Calculates snap positions to align cabinets with each other or walls.
  - **Selection**: Raycasts to detect which cabinet is clicked.
  - Delegates camera controls to `useCameraDrag`.

### 4. `useCameraDrag`

- **Location**: `src/features/scene/hooks/useCameraDrag.ts`
- **Purpose**: Manages **Camera Movement**.
- **Responsibilities**:
  - Implements **Orbit** (rotate around center), **Pan** (move sideways), and **Zoom**.
  - Supports two modes:
    - `constrained`: Limits movement to reasonable angles for room viewing.
    - `free`: Allows unrestricted 3D navigation.

---

## Feature Hooks (Functionality)

These hooks add specific features to the scene.

### 1. `useViewManager`

- **Location**: `src/features/cabinets/hooks/useViewManager.ts`
- **Purpose**: logical grouping of cabinets.
- **Responsibilities**:
  - Manages `View` objects (groups of cabinets).
  - Allows assigning cabinets to views.
  - Used for batch operations (e.g., changing dimensions for an entire wall of cabinets).

### 2. `useRoomPersistence`

- **Location**: `src/features/scene/hooks/useRoomPersistence.ts`
- **Purpose**: **Save/Load** functionality.
- **Responsibilities**:
  - **Saving**: Serializes the current scene state (walls, cabinets, views, materials) into a `SavedRoom` object.
  - **Loading**: Reconstructs the scene from a `SavedRoom` object, recreating cabinets and restoring their properties.

### 3. `useSnapGuides`

- **Location**: `src/features/scene/hooks/useSnapGuides.ts`
- **Purpose**: Visual feedback for alignment.
- **Responsibilities**:
  - Renders dashed `THREE.Line` objects to show where a cabinet is snapping (vertical/horizontal alignment).

### 4. `useDimensionLines`

- **Location**: `src/features/scene/hooks/useDimensionLines.ts`
- **Purpose**: Measurement visualization.
- **Responsibilities**:
  - Renders dynamic 3D lines and text sprites to show:
    - Cabinet dimensions (Width, Height, Depth).
    - Kicker height.
    - Overall view dimensions (Total Width, Total Height).
  - Updates automatically as cabinets move or resize.

### 5. `useCabinetNumbers`

- **Location**: `src/features/scene/hooks/useCabinetNumbers.ts`
- **Purpose**: Identification.
- **Responsibilities**:
  - Renders 3D text sprites (circles with numbers) above cabinets to show their sort order/index.

### 6. `useWallsAutoAdjust`

- **Location**: `src/features/scene/hooks/useWallsAutoAdjust.ts`
- **Purpose**: Dynamic environment.
- **Responsibilities**:
  - Automatically expands the back wall length if a cabinet is dragged beyond the current wall limit.
  - Adjusts "Additional Walls" (internal partitions) to avoid collisions.

### 7. `useProductDrivenCreation`

- **Location**: `src/features/scene/hooks/useProductDrivenCreation.ts`
- **Purpose**: Menu integration.
- **Responsibilities**:
  - Watches for product selection in the UI menu.
  - Triggers `createCabinet` to add the corresponding 3D model to the scene.

---

## Logic Handlers (Utils)

Complex business logic is extracted into standalone handler functions to keep components clean.

### 1. `handleViewDimensionChange`

- **Location**: `src/features/scene/utils/handlers/viewDimensionHandler.ts`
- **Purpose**: Batch dimension updates.
- **Logic**:
  - Updates dimensions for all cabinets in a specific view.
  - Handles **Paired Cabinets** and **Lock States** (e.g., if left edge is locked, expand right).
  - Shifts adjacent cabinets to prevent overlap when a cabinet grows.

### 2. `handleProductDimensionChange`

- **Location**: `src/features/scene/utils/handlers/productDimensionHandler.ts`
- **Purpose**: Single cabinet updates.
- **Logic**:
  - Updates dimensions for the selected cabinet.
  - Respects **Lock States** (Left Locked, Right Locked, Both Locked).
  - Handles **Sync Groups** (if multiple cabinets are synced, they update together).
  - Shifts adjacent cabinets in the same view to maintain relative spacing.

### 3. `handleSplashbackHeightChange`

- **Location**: `src/features/scene/utils/handlers/splashbackHandler.ts`
- **Purpose**: Vertical spacing.
- **Logic**:
  - Calculates and applies the vertical gap between Base/Tall cabinets and Top (Overhead) cabinets.

### 4. `handleDeleteCabinet`

- **Location**: `src/features/scene/utils/handlers/deleteCabinetHandler.ts`
- **Purpose**: Cleanup.
- **Logic**:
  - Removes cabinet from ViewManager.
  - Removes cabinet from any Groups.
  - Calls the core `deleteCabinet` function to remove from scene.

---

## UI Subcomponents

These React components overlay the 3D scene.

- **`ProductPanel`**: The main side panel for editing cabinet properties (dimensions, materials, doors, drawers).
- **`SettingsSidebar`**: Global scene settings.
- **`WallSettingsDrawer`**: Controls for wall dimensions and visibility.
- **`ViewsListDrawer` / `ViewDetailDrawer`**: Management UI for Views.
- **`CameraControls`**: On-screen buttons for camera manipulation.
- **`CabinetLockIcons`**: Visual toggles for locking cabinet sides (preventing movement/resize from that side).
