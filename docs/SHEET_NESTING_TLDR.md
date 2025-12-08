# Sheet Nesting — TLDR (Code Reference)

> Quick reference for the Sheet Nesting module. For detailed explanations, see [SHEET_NESTING.md](./SHEET_NESTING.md).

---

## Quick Reference Table

| File                 | Location                 | Responsibility                                             | Key Export(s)                                                   |
| -------------------- | ------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------- |
| `nest-types.ts`      | `src/nesting/`           | Type definitions for all nesting interfaces                | `Part`, `PlacedPart`, `Sheet`, `NestingResult`, `NestingConfig` |
| `nest-algorithm.ts`  | `src/nesting/`           | Skyline bin packing algorithm                              | `nestParts()`, `getPlacedFootprint()`                           |
| `nest-mapper.ts`     | `src/nesting/`           | Extracts 2D parts from 3D cabinets                         | `extractPartsFromScene()`                                       |
| `nest-serializer.ts` | `src/nesting/`           | Serializes cabinets for cross-tab transfer                 | `serializeCabinetsForNesting()`                                 |
| `nest-canvas.tsx`    | `src/nesting/`           | Canvas visualization component (zoom/pan/select)           | `<NestCanvas />`                                                |
| `PartDataManager.ts` | `src/nesting/`           | Singleton database of all part dimensions                  | `getPartDataManager()`, `PartDataManager` class                 |
| `usePartData.ts`     | `src/nesting/`           | React hook for PartDataManager sync                        | `usePartData()`                                                 |
| `ExportPartExcel.ts` | `src/nesting/`           | CSV export with dimensions                                 | `exportPartsToCSV()`                                            |
| `NestingModal.tsx`   | `src/features/scene/ui/` | Configuration modal (sheet size, grain, spacing)           | `<NestingModal />`                                              |
| `page.tsx`           | `src/app/nesting/`       | New tab page: receives data, runs algorithm, shows results | Default export (Next.js page)                                   |

---

## File Categories

### UI Layer (React Components)

- **NestingModal.tsx** — Entry point modal triggered from ThreeScene
- **page.tsx** — Standalone page that opens in new browser tab
- **nest-canvas.tsx** — Canvas renderer for sheet visualization

### Logic Layer (Pure Functions)

- **nest-algorithm.ts** — Skyline packing algorithm (no React dependencies)
- **nest-mapper.ts** — 3D→2D part extraction (works with live or serialized data)
- **nest-serializer.ts** — JSON serialization for cross-tab communication

### Data Layer (State Management)

- **PartDataManager.ts** — Singleton pattern, maintains part database
- **usePartData.ts** — React hook wrapper for PartDataManager

### Type Definitions

- **nest-types.ts** — All TypeScript interfaces (foundational, many files import this)

### Utilities

- **ExportPartExcel.ts** — CSV file generation and download

---

## Dependency Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ThreeScene.tsx                                    │
│                                                                             │
│   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐          │
│   │ NestingModal    │   │ usePartData     │   │ Export Button   │          │
│   └────────┬────────┘   └────────┬────────┘   └────────┬────────┘          │
└────────────┼─────────────────────┼─────────────────────┼────────────────────┘
             │                     │                     │
             ▼                     ▼                     ▼
    ┌────────────────┐    ┌────────────────┐    ┌────────────────┐
    │nest-serializer │    │PartDataManager │    │ExportPartExcel │
    └────────┬───────┘    │   (singleton)  │    └────────┬───────┘
             │            └────────────────┘             │
             │                     ▲                     ▼
             │                     │            ┌────────────────┐
             │                     └────────────│  nest-mapper   │
             │                                  └────────────────┘
             │
             │  [postMessage / sessionStorage]
             │
             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         /nesting/page.tsx (NEW TAB)                         │
│                                                                             │
│   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐          │
│   │  nest-mapper    │──▶│ nest-algorithm  │──▶│  nest-canvas    │          │
│   └─────────────────┘   └─────────────────┘   └─────────────────┘          │
│                                   │                     │                   │
│                                   └─────────────────────┘                   │
│                                    getPlacedFootprint()                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
                              ┌─────────────────┐
                              │  nest-types.ts  │  ◀── (imported by all above)
                              └─────────────────┘
```

---

## Runtime Data Flow

```
ThreeScene                                           New Browser Tab
    │                                                     │
    │ cabinets[]                                          │
    ▼                                                     │
┌─────────────┐                                           │
│NestingModal │                                           │
└──────┬──────┘                                           │
       │ serializeCabinetsForNesting()                    │
       ▼                                                  │
┌──────────────────┐    postMessage/sessionStorage   ┌────┴────┐
│ SerializedData[] │ ─────────────────────────────▶  │page.tsx │
└──────────────────┘                                 └────┬────┘
                                                          │ extractPartsFromScene()
                                                          ▼
                                                     ┌─────────┐
                                                     │ Part[]  │
                                                     └────┬────┘
                                                          │ nestParts()
                                                          ▼
                                                   ┌─────────────┐
                                                   │NestingResult│
                                                   └──────┬──────┘
                                                          │
                                                          ▼
                                                    ┌───────────┐
                                                    │NestCanvas │
                                                    └───────────┘
```

---

## Key Relationships Explained

### 1. `PartDataManager` ↔ `nest-mapper`
- **Why**: Provides standardized part names (`End-L` instead of `Left Panel`) and consistent dimensions
- **How**: `nest-mapper` checks `PartDataManager.getCabinetParts()` first, falls back to direct `carcass.getPartDimensions()` calculation

### 2. `nest-serializer` ↔ `page.tsx`
- **Why**: Can't pass `CabinetData` objects to new tab (they contain Three.js objects that can't be JSON-serialized)
- **How**: Modal calls `serializeCabinetsForNesting()` → sends via `postMessage`/`sessionStorage` → page.tsx receives and parses

### 3. `nest-algorithm` ↔ `nest-canvas`
- **Why**: Canvas needs to know actual rendered dimensions after rotation is applied
- **How**: Canvas imports and calls `getPlacedFootprint(part)` to get rotated width/height for drawing

### 4. `nest-types.ts` ↔ All Files
- **Why**: Single source of truth for type definitions prevents inconsistencies
- **How**: All other nesting files import types from this file (foundational dependency)

### 5. `PartDataManager` ↔ `MaterialLoader` (external)
- **Why**: Need human-readable material names from hex color codes
- **How**: Calls `MaterialLoader.findCarcassMaterialNameByColor()` and `findDoorMaterialNameByColor()`

### 6. `NestingModal` ↔ `PartDataManager`
- **Why**: Needs to update all cabinets with latest `wsProducts` data before serializing
- **How**: Serializer calls `partDataManager.updateAllCabinets(cabinets)` before extracting part data

---

## When to Edit What

| If you want to... | Edit this file |
|-------------------|----------------|
| Add new sheet size options | `NestingModal.tsx` → `SHEET_SIZES` array |
| Change packing algorithm | `nest-algorithm.ts` |
| Add new part type to extraction | `nest-mapper.ts` → `extractPartsFromScene()` |
| Add new URL parameter | `NestingModal.tsx` (sending) + `page.tsx` (receiving) |
| Change standardized part names | `PartDataManager.ts` → `mapPartName()` method |
| Add new CSV export column | `ExportPartExcel.ts` |
| Change canvas visualization | `nest-canvas.tsx` |
| Add new property to Part interface | `nest-types.ts` → then update files that create `Part` objects |
| Change cross-tab serialization | `nest-serializer.ts` → `SerializableCabinet` interface |
| Fix material name lookups | `PartDataManager.ts` or external `MaterialLoader.ts` |
| Change configuration UI | `NestingModal.tsx` |
| Change results page layout | `page.tsx` |

---

## Entry Points

| Entry Point | What It Does |
|-------------|--------------|
| `<NestingModal />` | Full flow: configure → serialize → open new tab → nest → visualize |
| `extractPartsFromScene()` + `exportPartsToCSV()` | CSV export only (no nesting algorithm) |
| `usePartData(cabinets, wsProducts)` | Part tracking during ThreeScene lifetime |

---

## Debugging Quick Reference

| Symptom | Check These Files |
|---------|-------------------|
| Parts not appearing in nesting | `nest-mapper.ts`, `PartDataManager.ts` |
| Wrong part dimensions | `CarcassAssembly.ts` → `getPartDimensions()` |
| Poor packing efficiency | `nest-algorithm.ts` → sorting strategy |
| Data not reaching new tab | `nest-serializer.ts`, `page.tsx` → data reception |
| Wrong material names | `PartDataManager.ts` → material lookup, `MaterialLoader.ts` |
| Canvas not rendering | `nest-canvas.tsx`, check `nestingResult` structure |
| Cross-tab communication failing | `NestingModal.tsx` → postMessage logic, `page.tsx` → message listener |

---

## External Dependencies

The nesting module depends on these external files:

- **`MaterialLoader`** (`src/features/carcass/MaterialLoader.ts`) — Material name lookups
- **`CarcassAssembly`** (`src/features/carcass/CarcassAssembly.ts`) — Source of `getPartDimensions()`
- **`CabinetData`** (`src/features/scene/types.ts`) — Cabinet data type
- **`WsProducts`** (`src/types/erpTypes.ts`) — Product name data from ERP

---

*For the full documentation with detailed explanations, see [SHEET_NESTING.md](./SHEET_NESTING.md).*
