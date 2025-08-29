# Three module responsibilities

- scene-utils: wall/floor construction and camera helpers
- cabinet-factory: pure creation of carcass assemblies with sensible defaults
- selection: selection/hover highlight utilities
- cabinet-adapter: map UI/ProductPanel events to CarcassAssembly API

Contracts

- scene-utils
  - createWall(scene, dims, color) -> Group
  - createFloor(scene, length) -> Mesh + Grid
  - positionCamera(camera, dims, zoom)
  - lookAtWallCenter(camera, dims)
- cabinet-factory
  - createCabinet(type, subId, opts?) -> { group, carcass, type, subcategoryId }
- selection
  - highlightSelected(Group) / clearHighlight(Group)
- useCameraDrag
  - returns { startDrag, move, end, wheel, middleClick }
