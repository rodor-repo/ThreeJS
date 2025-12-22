# Sheet Nesting (2D Panel Optimization)

This document provides a comprehensive guide to the **Sheet Nesting** feature, which optimizes the layout of cabinet components on 2D material sheets for manufacturing. It is designed to help AI assistants and developers understand the architecture, algorithms, and data flow within the nesting module.

---

## Overview

**Sheet Nesting** (also known as **2D Bin Packing**) is a manufacturing optimization feature that:

1. Extracts all component parts (panels, doors, drawers, shelves) from 3D cabinets in the scene.
2. Projects each 3D part to a 2D rectangle using its two largest dimensions.
3. Optimally arranges these rectangles on standard material sheets (e.g., MDF, plywood).
4. Minimizes material waste while respecting constraints like grain direction.

This feature is essential for cabinet manufacturing workflows, enabling accurate material ordering and efficient CNC cutting.

---

## Entry Point & User Flow

### Location in UI

- **Button**: Located in the bottom-right corner of `ThreeScene.tsx`, labeled "Nesting".
- **Icon**: Uses layout/grid iconography.

### User Flow

```
ThreeScene → Click "Nesting" button → NestingModal opens
    ↓
Configure options (sheet size, material, grain direction, cutting tool thickness)
    ↓
Click "Generate" → New browser tab opens
    ↓
/nesting page runs algorithm → Displays 2D sheet visualization
```

### Integration in ThreeScene

```typescript
// src/features/scene/ThreeScene.tsx
import { NestingModal } from './ui/NestingModal'

// State
const [showNestingModal, setShowNestingModal] = useState(false)

// Button onClick
setShowNestingModal(true)

// Component
<NestingModal
  isOpen={showNestingModal}
  onClose={() => setShowNestingModal(false)}
  cabinets={cabinets}
  wsProducts={wsProducts}
/>
```

---

## File Structure

All nesting-related files are located in `src/nesting/`:

```
src/nesting/
├── nest-types.ts          # Core TypeScript interfaces
├── nest-algorithm.ts      # Skyline/Bottom-Left packing algorithm
├── nest-mapper.ts         # 3D cabinet → 2D parts extraction
├── nest-serializer.ts     # Cross-tab data serialization
├── nest-canvas.tsx        # Canvas visualization component
├── PartDataManager.ts     # Singleton part dimension database
├── usePartData.ts         # React hook for PartDataManager
└── ExportPartExcel.ts     # CSV/Excel export utility

src/app/nesting/
└── page.tsx               # Next.js page (opens in new tab)

src/features/scene/ui/
└── NestingModal.tsx       # Configuration modal UI
```

---

## Core UI Components

### 1. NestingModal

- **Location**: `src/features/scene/ui/NestingModal.tsx`
- **Purpose**: Configuration UI for nesting parameters before generation.

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | `boolean` | Controls modal visibility |
| `onClose` | `() => void` | Callback when modal closes |
| `cabinets` | `CabinetData[]` | All cabinets in the scene |
| `wsProducts` | `WsProducts \| null` | Product data for name lookup |

#### Configuration Options

1. **Materials Dropdown**
   - Fetches all materials from `MaterialLoader.getAllMaterialsWithNames()`
   - Used for display purposes (doesn't filter parts)

2. **Sheet Size Dropdown**
   - Predefined standard sizes:
     - `2440 × 1220 mm` (common MDF/plywood)
     - `2720 × 1810 mm`
     - `3620 × 1810 mm`

3. **Grain Direction Checkbox**
   - When enabled, restricts part rotation to 0° and 180° only
   - Important for timber/veneer materials with visible grain

4. **Cutting Tools Thickness**
   - Spacing between parts on the sheet (default: 10mm)
   - Also applies to sheet boundaries

#### Data Serialization

The modal serializes cabinet data for cross-tab communication:

```typescript
import('@/nesting/nest-serializer').then(({ serializeCabinetsForNesting }) => {
  const serializedCabinets = serializeCabinetsForNesting(cabinets, wsProducts)
  // Store in sessionStorage + send via postMessage
})
```

---

### 2. Nesting Page

- **Location**: `src/app/nesting/page.tsx`
- **Purpose**: Next.js page that opens in a new browser tab to display nesting results.

#### Data Reception

The page receives cabinet data via multiple fallback methods:

1. **postMessage** (primary): Parent window sends data after tab opens
2. **sessionStorage** (fallback): Reads from stored key if postMessage fails
3. **URL parameters** (legacy): For small datasets that fit in URL

#### Key Responsibilities

- Parse configuration from URL search params (`sheetWidth`, `sheetHeight`, `materialId`, etc.)
- Extract parts using `extractPartsFromScene(cabinets)`
- Run nesting algorithm via `nestParts(parts, config)`
- Render results with `<NestCanvas />`
- Display efficiency statistics (% efficiency, waste in m²)

#### UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Header: Title, Material Info, Efficiency Stats, Close Btn  │
├────────────────────────────────────────────┬────────────────┤
│                                            │   Sidebar:     │
│           NestCanvas                       │   - Pagination │
│         (Sheet Visualization)              │   - Part Info  │
│                                            │   - Stats      │
│                                            │   - Controls   │
└────────────────────────────────────────────┴────────────────┘
```

---

### 3. NestCanvas

- **Location**: `src/nesting/nest-canvas.tsx`
- **Purpose**: Interactive canvas component for visualizing nested sheets.

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `nestingResult` | `NestingResult` | Algorithm output with sheets and parts |
| `selectedPartId` | `string \| null` | Currently selected part ID |
| `onPartSelect` | `(partId: string \| null) => void` | Selection callback |
| `currentSheetIndex` | `number` | Which sheet to display (pagination) |
| `onSheetChange` | `(index: number) => void` | Sheet navigation callback |

#### Features

- **Zoom**: Mouse wheel to zoom in/out (0.1x to 5x range)
- **Pan**: Click and drag to pan the view
- **Selection**: Click on a part to select it (shows details in sidebar)
- **Hover**: Hovering highlights part with brighter border
- **Initial Fit**: Auto-calculates zoom to fit sheet in viewport

#### Visual Indicators

- **Part Color**: Uses `materialColor` from part data
- **Orange Dot**: Indicates rotated part (90°, 180°, 270°)
- **Red Border + Dot**: Out-of-bounds error indicator
- **Part Labels**: Shows cabinet number, name, part name, and dimensions

---

## Types & Interfaces

- **Location**: `src/nesting/nest-types.ts`

### Core Types

```typescript
// A single rectangular part to be nested
interface Part {
  id: string
  label: string                    // Legacy, kept for compatibility
  width: number                    // Largest of 3D dimensions
  height: number                   // Second largest of 3D dimensions
  materialId: string
  materialName: string
  materialColor: string
  grainDirection?: 'horizontal' | 'vertical' | 'none'
  cabinetId?: string
  cabinetType?: string
  cabinetNumber?: number          // Sort number from scene
  cabinetName?: string            // Product name (e.g., "600 Base Cabinet")
  partName?: string               // Part identifier (e.g., "End-L", "Door 1")
  originalWidth: number
  originalHeight: number
  originalDimX?: number           // Original 3D X dimension
  originalDimY?: number           // Original 3D Y dimension
  originalDimZ?: number           // Original 3D Z dimension
}

// A part that has been placed on a sheet
interface PlacedPart extends Part {
  x: number                       // X position on sheet
  y: number                       // Y position on sheet
  rotation: 0 | 90 | 180 | 270    // Applied rotation
  sheetIndex: number              // Which sheet it's on
}

// A material sheet with placed parts
interface Sheet {
  index: number
  width: number
  height: number
  parts: PlacedPart[]
  shelves: Shelf[]                // Used by FFDH, empty for Skyline
}

// Configuration for the nesting algorithm
interface NestingConfig {
  sheetSize: SheetSize
  materialId: string
  materialName: string
  allowRotation: boolean
  grainDirection?: 'horizontal' | 'vertical' | 'none'
  sortStrategy?: 'height' | 'maxSide' | 'area'
  cuttingToolsThick?: number      // Default: 10mm
}

// Output of the nesting algorithm
interface NestingResult {
  sheets: Sheet[]
  totalSheets: number
  materialWaste: number           // In square millimeters
  materialEfficiency: number      // Percentage (0-100)
  totalParts: number
  placedParts: number
}
```

---

## Nesting Algorithm

- **Location**: `src/nesting/nest-algorithm.ts`
- **Algorithm**: **Skyline / Bottom-Left** packing

### How It Works

The Skyline algorithm maintains a "skyline" — a list of horizontal segments representing the top edges of placed parts. New parts are placed in the lowest available position.

```
Sheet with Skyline Profile:
┌───────────────────────────────┐
│         ████████              │ ← Skyline = top edges
│    ████ ████████              │
│    ████ ████████  ████        │
│    ████ ████████  ████        │
└───────────────────────────────┘
     ^    ^         ^
     Segment 1  Segment 2  Segment 3
```

### Key Functions

```typescript
// Main entry point
nestParts(parts: Part[], config: NestingConfig): NestingResult

// Try to place a part on a specific sheet
tryPlaceOnSheet(part: Part, sheet: SkylineSheet, config: NestingConfig): PlacedPart | null

// Find optimal position using skyline profile
findSkylinePosition(sheet, rectWidth, rectHeight, cuttingToolsThick): { x, y } | null

// Update skyline after placing a part
addRectToSkyline(sheet, x, width, y, height, cuttingToolsThick): void
```

### Rotation Logic

Rotation is controlled by grain direction:

| Grain Setting | Allowed Rotations |
|---------------|-------------------|
| No grain (`none`) | 0°, 90°, 180°, 270° |
| With grain (`horizontal`/`vertical`) | 0°, 180° only |
| `allowRotation: false` | 0° only |

### Sorting Strategies

Parts are sorted before packing (larger first = better efficiency):

- **`height`** (default): Sort by original height, descending
- **`maxSide`**: Sort by `max(width, height)`, descending
- **`area`**: Sort by `width × height`, descending

---

## Part Extraction (3D → 2D)

- **Location**: `src/nesting/nest-mapper.ts`
- **Purpose**: Converts 3D cabinet components into 2D rectangular parts.

### Dimension Mapping

Each 3D part has dimensions (X, Y, Z). The nesting system uses the **two largest dimensions** for 2D layout:

```typescript
function getTwoBiggestDimensions(dimX, dimY, dimZ): { width, height } {
  const sorted = [dimX, dimY, dimZ].sort((a, b) => b - a)  // Descending
  return {
    width: sorted[0],   // Largest dimension
    height: sorted[1],  // Second largest
  }
  // The smallest (thickness) is ignored for 2D layout
}
```

### Extracted Parts Per Cabinet

For each cabinet, the mapper extracts:

| Part Type | Source | Notes |
|-----------|--------|-------|
| End-L, End-R | Left/Right panels | Uses carcass material |
| Top, Bottom | Horizontal panels | Bottom only for base/tall/wardrobe |
| Back | Back panel | Uses carcass material |
| Rail | Base rail | For base cabinets |
| Shelf 1, 2, ... | Adjustable shelves | Count from config |
| Door 1, 2, ... | Door panels | Uses door material |
| Drawer Front 1, 2, ... | Drawer faces | Uses door material |
| Kicker | Kick panel | Uses door material |

### Data Sources

The mapper supports two input formats:

1. **Live `CabinetData`**: Uses `carcass.getPartDimensions()` directly
2. **Serialized `SerializableCabinet`**: Uses pre-calculated part data from `PartDataManager`

---

## Data Management

### PartDataManager

- **Location**: `src/nesting/PartDataManager.ts`
- **Pattern**: Singleton (use `getPartDataManager()`)
- **Purpose**: Maintains a live database of all part dimensions for all cabinets.

#### Key Methods

```typescript
// Get singleton instance
getPartDataManager(): PartDataManager

// Update parts when a cabinet changes
updateCabinetParts(cabinet: CabinetData): void

// Get all parts for a specific cabinet
getCabinetParts(cabinetId: string): PartData[]

// Get all parts from all cabinets
getAllParts(): PartData[]

// Sync entire scene
updateAllCabinets(cabinets: CabinetData[]): void

// Set product data for name lookups
setWsProducts(wsProducts: WsProducts): void
```

#### PartData Interface

```typescript
interface PartData {
  partId: string
  cabinetId: string
  cabinetType: string
  cabinetNumber?: number
  cabinetName: string       // Product name from wsProducts
  partName: string          // Standardized name (End-L, End-R, Back, etc.)
  dimX: number
  dimY: number
  dimZ: number
  materialId: string
  materialName: string      // Looked up from MaterialLoader
  materialColor: string
  lastUpdated: number
}
```

### usePartData Hook

- **Location**: `src/nesting/usePartData.ts`
- **Purpose**: React hook that automatically syncs PartDataManager with cabinets array.

```typescript
const {
  getAllParts,
  getCabinetParts,
  updateCabinet,
  removeCabinet,
  clear,
  getStats,
} = usePartData(cabinets, wsProducts)
```

### nest-serializer

- **Location**: `src/nesting/nest-serializer.ts`
- **Purpose**: Serializes `CabinetData[]` into JSON-safe format for cross-tab transfer.

#### Serialization Strategy

1. Modal generates nesting → calls `serializeCabinetsForNesting(cabinets, wsProducts)`
2. Data stored in `sessionStorage` with unique key
3. New tab opened with sessionKey in URL params
4. Parent sends data via `postMessage` (multiple attempts over 2 seconds)
5. New tab receives via `message` event listener
6. Fallback: reads from `sessionStorage` directly
7. Legacy fallback: reads from URL params (if data is small)

---

## Export Functionality

- **Location**: `src/nesting/ExportPartExcel.ts`
- **Trigger**: "Export Parts" button in ThreeScene (near Nesting button)

### CSV Export Format

| Column | Description |
|--------|-------------|
| Cabinet Number | Sort order number from scene |
| Cabinet Name | Product name (e.g., "600 Base Cabinet") |
| Part Name | Standardized name (End-L, End-R, Back, etc.) |
| Part Height | Largest dimension (mm) |
| Part Depth | Second largest dimension (mm) |
| Part Thickness | Smallest dimension (mm) |
| Part Materials | Material name from MaterialLoader |

### Usage

```typescript
import { exportPartsToCSV } from '@/nesting/ExportPartExcel'
import { extractPartsFromScene } from '@/nesting/nest-mapper'

const parts = extractPartsFromScene(cabinets)
exportPartsToCSV(parts, `nesting-parts-export-${Date.now()}.csv`)
```

---

## Key Concepts

### Grain Direction

Materials like timber veneers have a visible grain pattern that must be aligned consistently. When grain direction is enabled:

- Parts can only rotate 0° or 180° (not 90° or 270°)
- This maintains grain alignment across all parts
- Set via checkbox in NestingModal

### Cutting Tool Thickness

CNC routers and saws have a blade width (kerf). The `cuttingToolsThick` parameter:

- Adds spacing between adjacent parts (default: 10mm)
- Also adds margin from sheet edges
- Prevents parts from overlapping after cutting

### Efficiency Calculation

```typescript
const materialEfficiency = (totalUsedArea / totalSheetArea) * 100

// Where:
// totalUsedArea = sum of (part.width × part.height) for all placed parts
// totalSheetArea = sum of (sheet.width × sheet.height) for all sheets used
```

Higher efficiency = less material waste.

---

## Data Flow Summary

```
┌─────────────────┐
│   ThreeScene    │
│   (cabinets)    │
└────────┬────────┘
         │ Click "Nesting"
         ▼
┌─────────────────┐
│  NestingModal   │
│  (configure)    │
└────────┬────────┘
         │ "Generate" → serializeCabinetsForNesting()
         │
         ▼
┌─────────────────┐     postMessage/sessionStorage
│   /nesting      │◄─────────────────────────────────
│   (new tab)     │
└────────┬────────┘
         │ extractPartsFromScene(serialized)
         ▼
┌─────────────────┐
│  nest-mapper    │
│  (3D → 2D)      │
└────────┬────────┘
         │ Part[]
         ▼
┌─────────────────┐
│ nest-algorithm  │
│ (Skyline pack)  │
└────────┬────────┘
         │ NestingResult
         ▼
┌─────────────────┐
│   NestCanvas    │
│  (visualization)│
└─────────────────┘
```

---

## Related Documentation

- **AI Coding Assistant Guide**: `docs/AI_CODING_ASSISTANT_GUIDE.md` - Overview of ThreeScene and its hooks
- **CarcassAssembly**: `src/features/carcass/CarcassAssembly.ts` - Source of `getPartDimensions()`
- **MaterialLoader**: `src/features/carcass/MaterialLoader.ts` - Material name lookups
