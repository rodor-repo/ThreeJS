# Cabinet Relations Guide

This guide documents the three types of relationships between cabinets in the 3D scene. Each relationship type controls how cabinets behave when one is resized.

---

## 1. Views

**Location**: `src/features/cabinets/ViewManager.ts`

**Data Structure**:

```typescript
type ViewId = "A" | "B" | ... | "Z" | "none"
// Cabinet has: viewId?: ViewId
```

### Purpose

Logical grouping of cabinets, typically representing a wall or section of the kitchen.

### Behavior

When a cabinet's **width changes**, all other cabinets in the same view are **repositioned** to maintain relative spacing:

- **Left-locked cabinet**: Cabinets to the RIGHT shift by `widthDelta`
- **Right-locked cabinet**: Cabinets to the LEFT shift by `-widthDelta`
- **Unlocked cabinet**: Cabinets on both sides shift by `±(widthDelta / 2)`

### Key Points

- Views only affect **repositioning**, not resizing of other cabinets
- Cabinets that are **paired** skip view repositioning (handled by pair logic)
- Maximum 26 views (A-Z)
- Used for batch dimension updates via `ViewDetailDrawer`

---

## 2. Pairs (Groups)

**Location**: `ThreeScene.tsx` state

**Data Structure**:

```typescript
cabinetGroups: Map<string, Array<{ cabinetId: string; percentage: number }>>
// Maps ownerCabinetId -> [{ pairedCabinetId, percentage }, ...]
```

### Purpose

Link cabinets so they resize **proportionally** when one changes width.

### Behavior

When a cabinet's width changes by `widthDelta`:

1. Each paired cabinet changes width by: `widthDelta × (percentage / 100)`
2. Paired cabinets respect their own **lock states** when determining resize direction
3. Paired cabinets are **excluded from view repositioning** (they handle their own position)

### Example

```
Cabinet A (owner) has pairs:
  - Cabinet B: 50%
  - Cabinet C: 25%

If Cabinet A width increases by +100mm:
  - Cabinet B width increases by +50mm
  - Cabinet C width increases by +25mm
```

### Key Points

- Percentages should typically sum to 100% for balanced behavior
- Bidirectional check: A↔B pairing is recognized from either cabinet's group
- Lock states (leftLock/rightLock) control which edge the paired cabinet expands from
- Removing a cabinet from its view also removes all its pair relations

---

## 3. Sync Groups

**Location**: `ThreeScene.tsx` state

**Data Structure**:

```typescript
cabinetSyncs: Map<string, string[]>
// Maps cabinetId -> [syncedCabinetId1, syncedCabinetId2, ...]
```

### Purpose

Maintain **constant total width** across a group of cabinets. When one gets wider, others shrink to compensate.

### Behavior

When a synced cabinet's width changes by `widthDelta`:

1. **Total sync width is preserved** (sum of all synced cabinets' widths stays constant)
2. Width delta is **distributed inversely** among other synced cabinets: `-widthDelta / numOtherCabinets`
3. Cabinets are sorted by X position for repositioning
4. **Rightmost cabinets**: Maintain right edge (extend left)
5. **Middle cabinets**: Resize and shift based on cumulative changes from right

### Example

```
Sync Group: [Cabinet 1, Cabinet 2, Cabinet 3]
Initial widths: 300mm, 300mm, 300mm (total: 900mm)

If Cabinet 1 width increases to 400mm (+100mm):
  - Cabinet 2: 300 - 50 = 250mm
  - Cabinet 3: 300 - 50 = 250mm
  - Total remains: 900mm
```

### Key Points

- **Highest priority**: Overrides both lock system and pair system
- Only applies when **multiple synced cabinets are selected**
- Requires at least 2 synced cabinets in selection for sync logic to trigger
- If sync doesn't apply, falls back to normal lock/pair behavior

---

## Priority Order

When resizing a cabinet, the system checks in this order:

1. **Sync Group** (if multiple synced cabinets selected) → Apply sync logic, skip everything else
2. **Lock States** → Determine resize direction (left-locked, right-locked, or center)
3. **Pairs** → Apply proportional resize to paired cabinets
4. **Views** → Reposition non-paired cabinets in same view

---

## Quick Reference

| Relation | Effect                           | Scope                    | Priority |
| -------- | -------------------------------- | ------------------------ | -------- |
| **View** | Repositions neighbors            | Same viewId              | Low      |
| **Pair** | Proportional resize              | Linked cabinets          | Medium   |
| **Sync** | Inverse resize (total preserved) | Selected synced cabinets | Highest  |

---

## Handlers

- **Single cabinet changes**: `src/features/scene/utils/handlers/productDimensionHandler.ts`
- **View-wide changes**: `src/features/scene/utils/handlers/viewDimensionHandler.ts`
- **ViewManager class**: `src/features/cabinets/ViewManager.ts`
