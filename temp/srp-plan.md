# SRP Refactor Plan for ThreeScene

Goal: Apply Single Responsibility Principle (SRP) to simplify `src/components/ThreeScene.tsx` by separating concerns into focused modules with clear contracts.

## Steps

1. Extract scene utilities (wall/floor creation, camera math, event helpers) into `src/components/three/scene-utils.ts` and wire `ThreeScene.tsx` to use them — DONE
2. Move cabinet creation/config logic into `src/components/three/cabinet-factory.ts` (no UI state) and update usages — DONE
3. Isolate camera controls into a tiny hook `src/hooks/useCameraDrag.ts` (pure mouse-to-camera math, no ProductPanel coupling) — DONE
4. Encapsulate selection/highlighting into `src/components/three/selection.ts` utilities — DONE
5. Extract ProductPanel interaction mapping (adapters) into `src/components/three/cabinet-adapter.ts` to keep TS types and translation clean — DONE (wired but current handlers in `ThreeScene.tsx` still call Carcass methods directly; adapter available for consolidation)
6. Add lightweight unit tests for math helpers and factory defaults with Vitest — IN PROGRESS
7. Add README in `src/components/three/` that documents responsibilities and simple contracts — DONE

## Contracts (high level)

- scene-utils
  - buildWall(dims, color) -> Group
  - buildFloor(length) -> { floor: Mesh, grid: GridHelper }
  - positionCamera(camera, dims, zoom) -> void
  - lookAtWallCenter(camera, dims) -> void
- cabinet-factory
  - createCabinet(type, subId, defaults?) -> { group, carcass, type, subcategoryId }
- selection
  - highlightSelected(group) / clearHighlight(group) / clearAll(scene)
- useCameraDrag
  - returns handlers { startDrag, move, end, wheel, middleClick } (SSR-safe: no document access within hook init)

## Notes

- Keep behavior identical; only move code and replace inline with imports
- No component prop/API changes
- Use Typescript, lodash, Tailwind; avoid semicolons
