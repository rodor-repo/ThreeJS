# View Rules Documentation

This document describes all the rules and systems that govern cabinet behavior within views in the 3D scene.

## Table of Contents

1. [Sync System](#sync-system)
2. [Pair System (Group System)](#pair-system-group-system)
3. [Lock System](#lock-system)
4. [View Rules](#view-rules)
5. [Boundary Wall Rules](#boundary-wall-rules)
6. [Wall Positioning Rules](#wall-positioning-rules)
7. [Rule Precedence](#rule-precedence)

---

## Sync System

### Description
The Sync System allows multiple cabinets within the same view to maintain a fixed overall width and boundary positions when one cabinet's width is changed.

### Key Features
- **Overall Width Maintenance**: When multiple synced cabinets are selected and one cabinet's width changes, the overall width of all selected synced cabinets remains fixed.
- **Boundary Position Maintenance**: The far-left X position and far-right X position of selected synced cabinets remain fixed.
- **Width Delta Distribution**: When a cabinet's width changes, the delta width is distributed among other cabinets in the selected sync list to maintain the overall width.
- **Repositioning Logic**: 
  - Rightmost cabinet: Resizes and maintains its right edge position (moves left if width increases).
  - Middle cabinets: Resize and reposition left based on width adjustments from cabinets to their right.
  - Leftmost cabinet: Maintains its left edge position.

### Usage
- Cabinets can be added to a sync list via the Right Drawer (Product Panel) under the "Sync" section.
- Only cabinets within the same view can be synced together.
- Sync relationships are stored per cabinet.

### Rule Precedence
- **Highest Priority**: Sync System overrides Pair System and Lock System when multiple synced cabinets are selected.

---

## Pair System (Group System)

### Description
The Pair System allows cabinets to be grouped together with percentage-based width distribution. When one cabinet in a group changes width, other cabinets in the group adjust proportionally.

### Key Features
- **Percentage-Based Distribution**: Each cabinet in a group has a percentage that determines its share of the total group width.
- **Proportional Adjustment**: When one cabinet's width changes, other cabinets in the group adjust their widths proportionally to maintain their percentage ratios.
- **Group Management**: Cabinets can be added/removed from groups via the Right Drawer (Product Panel) under the "Pair" section.

### Usage
- Cabinets can be paired/grouped via the Right Drawer (Product Panel) under the "Pair" section.
- Only cabinets within the same view can be paired together.
- Each cabinet in a pair/group has a percentage value (must sum to 100%).

### Rule Precedence
- **Lower Priority**: Pair System is overridden by Sync System when sync rules apply.

---

## Lock System

### Description
The Lock System allows individual cabinets to have their left or right edges locked, preventing movement in specific directions during width changes.

### Key Features
- **Left Lock**: When enabled, the left edge of the cabinet is frozen. The cabinet can only extend/shrink to the right (positive X direction).
- **Right Lock**: When enabled, the right edge of the cabinet is frozen. The cabinet can only extend/shrink to the left (negative X direction).
- **Both Locks**: When both locks are enabled, the cabinet cannot change width (both edges are frozen).
- **No Locks**: When neither lock is enabled, the cabinet extends/shrinks equally from both sides (center position remains fixed).

### Usage
- Locks can be toggled by double-clicking a cabinet to open the Lock Icons overlay.
- Three lock icons appear: Left, Center, Right.
- Clicking a lock icon toggles its state.

### Rule Precedence
- **Lower Priority**: Lock System is overridden by Sync System and Pair System when those rules apply.

---

## View Rules

### Description
Views are organizational groups that allow cabinets to be managed together. Cabinets in the same view share certain behaviors.

### Key Features
- **Grouped Movement**: When a cabinet in a view is dragged, all other cabinets in the same view move together, maintaining their relative positions.
- **View Assignment**: Each cabinet can be assigned to a view (or "none").
- **View Management**: Views can be created, deleted, and cabinets can be assigned/removed from views.
- **View Deletion**: When a view is deleted, all cabinets in that view are automatically set to "none" view.

### Usage
- Views can be managed via the Right Drawer (Product Panel) under the "View" section.
- Views can be deleted via the Settings Sidebar or Views List Drawer using the delete icon.
- Cabinets can be assigned to views via the View dropdown in the Product Panel.

### Movement Behavior
- When dragging a cabinet that belongs to a view, all cabinets in that view move together by the same delta.
- Only the left boundary (X=0) is enforced - cabinets can penetrate the right wall.
- Y-axis overlap detection prevents cabinets from overlapping vertically.

---

## Boundary Wall Rules

### Description
Boundary walls define the limits of the scene. The system enforces certain boundaries while allowing penetration of others.

### Key Features
- **Left Wall Boundary**: Always enforced at X=0. Cabinets cannot move or extend beyond this boundary.
- **Right Wall Boundary**: Not enforced. Cabinets can penetrate the right wall and push it back.
- **Internal Walls**: Not enforced as boundaries. Cabinets can penetrate internal walls and push them back.
- **Back Wall**: Defines the Z=0 plane. Overall measurement lines are positioned relative to this wall.

### Behavior
- **Right Wall Penetration**: When cabinets reach or exceed the right wall boundary, they continue moving and the wall position adjusts automatically.
- **Internal Wall Penetration**: When cabinets penetrate internal walls, the wall positions adjust automatically to accommodate them.
- **View-Linked Right Wall**: If the right wall is linked to a view, the back wall length automatically adjusts when cabinets in that view penetrate the right wall.

### Usage
- Right wall and internal walls can be linked to views via the Wall Settings Drawer.
- When linked to a view, walls automatically adjust their positions based on cabinet positions in that view.

---

## Wall Positioning Rules

### Description
Walls can be positioned relative to views, allowing automatic adjustment based on cabinet positions.

### Right Wall Positioning
- **View Linking**: The right wall can be linked to a specific view.
- **Automatic Adjustment**: When linked to a view, the right wall position (and back wall length) automatically adjusts to match the rightmost edge of cabinets in that view.
- **Position Calculation**: The right wall's left corner is positioned at the rightmost X position of cabinets in the linked view.

### Internal Wall Positioning
- **View Linking**: Each internal wall can be linked to a specific view.
- **Distance-Based Positioning**: Internal walls are positioned at their "Distance from Left" value.
- **No Back Wall Adjustment**: Internal walls do not adjust the back wall length when repositioned.

### Usage
- Wall-view associations can be set via the Wall Settings Drawer.
- Right wall view selection is under the "Right Wall" section.
- Internal wall view selection is under each wall's "Thickness" setting.

---

## Rule Precedence

When multiple rules could apply to a cabinet operation, the following precedence order is used:

1. **Sync System** (Highest Priority)
   - Applies when multiple synced cabinets are selected and one changes width.
   - Overrides Pair System and Lock System.

2. **Pair System** (Medium Priority)
   - Applies when cabinets are grouped and one changes width.
   - Overrides Lock System.
   - Overridden by Sync System.

3. **Lock System** (Lowest Priority)
   - Applies to individual cabinets when no other rules are active.
   - Overridden by Sync System and Pair System.

4. **View Rules** (Always Active)
   - Movement rules apply regardless of other systems.
   - Work in conjunction with other rules.

5. **Boundary Wall Rules** (Always Active)
   - Left boundary enforcement is always active.
   - Right wall penetration is always allowed.

---

## Notes

- All rules operate within the context of views. Cabinets must be in the same view to be synced or paired.
- When a cabinet is removed from a view (set to "none"), all group and sync relationships are automatically cleared.
- Wall positioning rules work independently of cabinet rules but can be influenced by view-linked cabinets.
- The system prioritizes maintaining overall dimensions and relationships over individual cabinet constraints.








