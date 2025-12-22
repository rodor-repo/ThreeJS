/**
 * Constants for cabinet builder dimensions
 * Centralized magic numbers for maintainability
 */

// Shelf positioning
export const SHELF_OFFSET_FROM_EDGE = 100 // mm - distance from top/bottom edges for shelf placement

// Leg dimensions
export const LEG_DIAMETER = 50 // mm - standard leg diameter

// Wardrobe-specific defaults (also in CarcassConfig but repeated here for clarity)
export const DEFAULT_WARDROBE_DRAWER_HEIGHT = 220 // mm
export const DEFAULT_WARDROBE_DRAWER_BUFFER = 50 // mm - space between drawers and shelves

// Bulkhead-specific
export const BULKHEAD_RETURN_THICKNESS = 16 // mm - fixed thickness for bulkhead returns

// Benchtop-specific
export const DEFAULT_BENCHTOP_THICKNESS = 38 // mm
export const BENCHTOP_FIXED_DEPTH_EXTENSION = 20 // mm - fixed extension beyond cabinet depth
export const DEFAULT_BENCHTOP_FRONT_OVERHANG = 20 // mm - default front overhang for child benchtops

// Part naming conventions for export/nesting
export const PART_NAMES = {
  LEFT_PANEL: "Left Panel",
  RIGHT_PANEL: "Right Panel",
  BACK_PANEL: "Back Panel",
  TOP_PANEL: "Top Panel",
  BASE_RAIL: "Base Rail",
  BOTTOM_PANEL: "Bottom Panel",
  SHELF: "Shelf",
  DOOR: "Door",
  DRAWER_FRONT: "Drawer Front",
  BENCHTOP: "Benchtop",
} as const
