# User Mode (Feature)

User Mode is a simplified interaction layer for end-users editing an existing room/template, with reduced UI and safer interactions compared to Admin Mode.

This doc describes the **current implemented behavior** (which differs slightly from the original plan), including the center-screen `UserWidthSlider` UI.

## Key goals (as implemented)

- Keep camera navigation available in both modes
- Prevent cabinet dragging/movement in User Mode
- Prevent destructive actions (clear all, delete cabinet) in User Mode
- Provide a simple “adjust width” control in User Mode
- Keep full editing tools (ProductPanel, lock overlay, etc.) in Admin Mode

## Mode model

- Mode type: `AppMode = "admin" | "user"`
  - Defined in: [src/features/scene/context/ModeContext.tsx](../src/features/scene/context/ModeContext.tsx)
- The mode is stored at the page level and passed down:
  - State lives in: [src/app/page.tsx](../src/app/page.tsx)
  - Passed into the scene: [src/features/scene/ThreeScene.tsx](../src/features/scene/ThreeScene.tsx)
- A `ModeContext.Provider` is also mounted inside the scene:
  - Provider is in: [src/features/scene/ThreeScene.tsx](../src/features/scene/ThreeScene.tsx)

## UI behavior by mode

### Mode toggle

- The toggle UI is always visible (top center):
  - [src/features/scene/ui/ModeToggle.tsx](../src/features/scene/ui/ModeToggle.tsx)

### Main menu (cabinet adding)

- The left-side MainMenu is hidden entirely in User Mode:
  - Implemented in: [src/app/page.tsx](../src/app/page.tsx)

Impact:

- In User Mode, users generally cannot add new cabinets via the menu.
- Users can still load rooms that already contain cabinets.

### Admin-only UI

These elements are explicitly restricted to Admin Mode:

- Bottom-right actions (Export / Nesting / Settings):

  - Rendered only when `selectedMode === 'admin'` in [src/features/scene/ThreeScene.tsx](../src/features/scene/ThreeScene.tsx)

- ProductPanel (non-appliance cabinets):

  - Rendered only when `selectedMode === 'admin'` in [src/features/scene/ThreeScene.tsx](../src/features/scene/ThreeScene.tsx)

- Cabinet lock overlay (`CabinetLockIcons`):

  - Rendered only when `selectedMode === 'admin'` in [src/features/scene/ThreeScene.tsx](../src/features/scene/ThreeScene.tsx)

- CameraControls: Clear-all and Delete buttons are Admin-only:
  - [src/features/scene/ui/CameraControls.tsx](../src/features/scene/ui/CameraControls.tsx)

### User-only UI

- `UserWidthSlider` (simple width adjustment):
  - Rendered only when `selectedMode === 'user'` in [src/features/scene/ThreeScene.tsx](../src/features/scene/ThreeScene.tsx)
  - Component: [src/features/scene/ui/UserWidthSlider.tsx](../src/features/scene/ui/UserWidthSlider.tsx)

Implementation detail (intentional): the slider is **fixed at the top center of the screen** rather than positioned over the clicked cabinet.

### Always-on UI (both modes)

These controls are currently available regardless of mode:

- CartSection (Add to Cart / My Rooms / Save Room):

  - [src/features/scene/ui/CartSection.tsx](../src/features/scene/ui/CartSection.tsx)

- CameraControls base navigation:

  - 3D view reset + X/Y/Z orthographic views
  - Dimension toggle (D)
  - Number toggle (N) if enabled
  - [src/features/scene/ui/CameraControls.tsx](../src/features/scene/ui/CameraControls.tsx)

- HistoryControls (undo/redo/checkpoints):

  - [src/features/scene/ui/HistoryControls.tsx](../src/features/scene/ui/HistoryControls.tsx)

- Dimension line controls:
  - [src/features/scene/ui/DimensionLineControls.tsx](../src/features/scene/ui/DimensionLineControls.tsx)

Note: “Settings” UI components (drawers/sidebars) are still mounted in the tree, but the primary entry button for opening Settings is Admin-only (via BottomRightActions). See “Wall double-click” below for an important exception.

## Interaction rules (implemented)

All pointer/mouse interactions are centralized here:

- [src/features/scene/hooks/useSceneInteractions.ts](../src/features/scene/hooks/useSceneInteractions.ts)

### Cabinet dragging

- Dragging is **disabled in User Mode**.
- Drag start checks `mode === 'admin'` in multiple places:
  - Move-distance threshold start (click-and-drag)
  - Left-mousedown drag initialization

Result:

- In User Mode, cabinets can be selected but not moved.

### Cabinet selection

- Single click selects cabinets (does not open ProductPanel)
- Shift-click toggles multi-select

### Right click behavior

- Admin Mode:

  - Right-click selects a single cabinet and opens ProductPanel (for eligible cabinet types)

- User Mode:
  - Right-click behavior is selection-safe to support synced resizing:
    - If the cabinet is not already selected, selection becomes only that cabinet
    - If it’s already selected, selection is kept as-is (so multi-select can remain)
  - If eligible, right-click opens the width slider:
    - Not shown when `hideLockIcons === true`
    - Not shown for `cabinetType === 'kicker'`

### Double click behavior

- Admin Mode:

  - Double-click selects the cabinet and toggles the lock overlay (`CabinetLockIcons`)

- User Mode:
  - Double-click selects the cabinet
  - Does not open the width slider (the slider is opened via right-click)

### Wall double-click

There is currently a mode-agnostic behavior:

- Double-clicking a wall (empty wall area) opens the Wall settings drawer if `onOpenWallDrawer` is provided.
- This is not currently gated by mode.

Relevant logic:

- Wall double-click detection in [src/features/scene/hooks/useSceneInteractions.ts](../src/features/scene/hooks/useSceneInteractions.ts)
- Drawer open callback wired from [src/features/scene/ThreeScene.tsx](../src/features/scene/ThreeScene.tsx)

If you want User Mode to be fully “no wall settings”, add a `mode === 'admin'` guard around the wall-double-click open.

## UserWidthSlider details

Component:

- [src/features/scene/ui/UserWidthSlider.tsx](../src/features/scene/ui/UserWidthSlider.tsx)

Behavior:

- Fixed-position UI at top center (`left-1/2 top-20 -translate-x-1/2`)
- Backdrop click closes the slider
- Updates width in real-time (no debounce in the slider itself)
- Slider step is `1mm`

Constraints:

- `minWidth`/`maxWidth` are passed from `getWidthConstraints(productId)` when possible.
- Constraint lookup reads cached product data from React Query:
  - [src/features/scene/utils/handlers/productDimensionHandler.ts](../src/features/scene/utils/handlers/productDimensionHandler.ts)
- If constraints aren’t available, defaults are used:
  - `minWidth = 200`, `maxWidth = 1200`

## How width changes apply

The width slider calls `onWidthChange(cabinetId, newWidth)`.

In the scene:

- Handler: `handleUserWidthChange` in [src/features/scene/ThreeScene.tsx](../src/features/scene/ThreeScene.tsx)
- Applies the change through the same pipeline used by ProductPanel:
  - `handleProductDimensionChange(...)`

This preserves existing rules:

- sync relationships (resizing synced cabinets together)
- paired/group cabinet constraints
- lock behavior (left/right locks) for admin-created lock states
- validity checks (min/max constraints; left wall overflow in views, etc.)

## Quick manual test checklist

- Toggle Admin/User from the top-center switch
- In User Mode:

  - Attempt to drag a cabinet (should not move)
  - Right-click cabinet (should open width slider if eligible)
  - Double-click cabinet (should select only)
  - Confirm Clear (C) and Delete buttons are not shown
  - Confirm MainMenu is hidden

- In Admin Mode:
  - Right-click opens ProductPanel
  - Double-click opens CabinetLockIcons
  - Dragging works
  - Clear (C) and Delete are available
