# Three module responsibilities

- scene-utils: wall/floor construction and camera helpers
- cabinet-factory: pure creation of carcass assemblies with sensible defaults
- selection: selection/hover highlight utilities
- cabinet-adapter: map UI/ProductPanel events to CarcassAssembly API
- hooks and UI: renderer bootstrap, cabinets state, scene interactions, and small presentational controls

Contracts

- scene-utils
  - buildWall(dims, color?) -> Group
  - buildFloor(length) -> { floor: Mesh, grid: GridHelper }
  - positionCamera(camera, dims, zoom)
  - lookAtWallCenter(camera, dims)
  - WALL_THICKNESS constant
- cabinet-factory
  - createCabinet(type, subId, opts?) -> { group, carcass, cabinetType, subcategoryId }
- selection
  - highlightSelected(group) / clearHighlight(group) / pulseHover(group) / unpulseHover(group)
- useCameraDrag
  - returns { startDrag, move, end, wheel, middleClick }

## TL;DR: new hooks and components

### useThreeRenderer

Encapsulates Three.js scene/camera/renderer lifecycle and helpers

- inputs: `(mountRef, wallDimensions, wallColor)`
- returns refs: `sceneRef`, `rendererRef`, `cameraRef`, `wallRef`, `floorRef`, `floorGridRef`
- helpers: `createWall(height, length, color?)`, `createFloor(length)`, `updateCameraPosition(height, length, zoomLevel)`, `resetCamera(zoomLevel)`, `setCameraXView()`, `setCameraYView()`, `setCameraZView()`

Use when you need a ready-to-render scene without polluting component code

### useCabinets

Owns cabinet collection state and highlighting

- inputs: `(sceneRef)`
- returns state: `cabinets`, `selectedCabinet`, `showProductPanel`
- setters: `setSelectedCabinet`, `setShowProductPanel`
- actions: `createCabinet(type, subId)`, `clearCabinets()`, `addHoverEffect(cab)`, `removeHoverEffect(cab)`

Use when you want consistent cabinet creation/clearing and selection behavior

### useSceneInteractions

Global mouse interactions for camera drag/zoom, cabinet selection and dragging

- inputs: `(cameraRef, wallDimensions, isMenuOpen, cabinets, selectedCabinet, setSelectedCabinet, showProductPanel, setShowProductPanel, cameraDrag)`
- returns: `{ isDraggingCabinet }`

Use to wire document-level handlers without bloating the component

### UI components

- CameraControls

  - props: `isDragging`, `onReset`, `onClear`, `onX`, `onY`, `onZ`
  - small control strip for camera and scene actions

- WallSettingsModal

  - props: `isOpen`, `onClose`, `wallDimensions`, `wallColor`, `onApply(dims, color)`
  - encapsulates wall size/color editing UI

- CabinetsInfoPanel
  - props: `cabinets`
  - compact info block listing cabinets and total count

### cabinet-adapter (UI -> carcass API)

Tiny wrappers that translate ProductPanel changes to `CarcassAssembly` API calls

- `applyDimensions`, `applyMaterialProps`, `applyKicker`
- `toggleDoors`, `setDoorMaterial`, `setDoorCount`, `setOverhang`
- `toggleDrawers`, `setDrawerQty`, `setDrawerHeight`
- `balanceDrawerHeights`, `resetDrawerHeights`

### types

Common types used across the 3D modules

- `WallDimensions`
- `Category`
- `CabinetData`
