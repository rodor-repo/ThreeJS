/**
 * Saved Rooms Data Storage - Type Definitions
 *
 * This file defines types and interfaces for saved room configurations.
 * Storage is handled via Firestore in:
 * - src/server/rooms/saveRoomDesign.ts
 * - src/server/rooms/getRoomDesign.ts
 */

import { CabinetType } from "@/features/carcass"

/**
 * Room category type.
 * Note: In the new architecture, categories come from wsRooms.categories in Firestore.
 * This type is kept for backward compatibility with serializeRoom/restoreRoom.
 */
export type RoomCategory =
  | "Kitchen"
  | "Pantry"
  | "Laundry"
  | "Wardrobe"
  | "Vanity"
  | "TV Room"
  | "Alfresco"

export interface SavedCabinet {
  cabinetId: string
  productId?: string
  productName?: string
  cabinetType: CabinetType
  subcategoryId: string
  dimensions: {
    width: number
    height: number
    depth: number
  }
  viewId?: string
  position: {
    x: number
    y: number
    z: number
  }
  materialSelections?: Record<
    string,
    { priceRangeId: string; colorId: string; finishId?: string }
  >
  materialColor?: string
  dimensionValues?: Record<string, number | string>
  shelfCount?: number
  doorEnabled?: boolean
  doorCount?: number
  overhangDoor?: boolean
  drawerEnabled?: boolean
  drawerQuantity?: number
  drawerHeights?: number[]
  kickerHeight?: number
  leftLock?: boolean // When locked, left edge is frozen - cabinet can only extend to the right
  rightLock?: boolean // When locked, right edge is frozen - cabinet can only extend to the left
  group?: Array<{ cabinetId: string; percentage: number }> // Grouped cabinets with their percentage portions
  sortNumber?: number // Sort number based on order cabinets were added to the scene
  syncCabinets?: string[] // Synced cabinets
  /** Parent cabinet ID - used for fillers/panels added from modal */
  parentCabinetId?: string
  /** Side relative to parent ('left' | 'right') - used for fillers/panels added from modal */
  parentSide?: "left" | "right"
  /** Flag to hide lock icons - used for fillers/panels added from modal */
  hideLockIcons?: boolean
  /** For kicker type: parent cabinet ID that this kicker belongs to */
  kickerParentCabinetId?: string
  /** For bulkhead type: parent cabinet ID that this bulkhead belongs to */
  bulkheadParentCabinetId?: string
  /** For underPanel type: parent cabinet ID that this under panel belongs to */
  underPanelParentCabinetId?: string
  /** Number of doors for fridge (1 or 2) */
  fridgeDoorCount?: 1 | 2
  /** Handle side for 1-door fridge */
  fridgeDoorSide?: "left" | "right"
  /** Appliance specific properties */
  applianceType?: "dishwasher" | "washingMachine" | "sideBySideFridge"
  applianceTopGap?: number
  applianceLeftGap?: number
  applianceRightGap?: number
  applianceKickerHeight?: number
  /** Benchtop specific properties */
  benchtopParentCabinetId?: string
  benchtopFrontOverhang?: number
  benchtopLeftOverhang?: number
  benchtopRightOverhang?: number
  benchtopThickness?: number
  benchtopHeightFromFloor?: number
}

export interface SavedView {
  id: string
  name: string
  cabinetIds: string[]
}

export interface SavedRoom {
  id: string
  name: string
  category: RoomCategory
  savedAt: string
  wallSettings: {
    height: number
    length: number // Back wall length (for backward compatibility)
    color: string
    backWallLength?: number
    leftWallLength?: number
    rightWallLength?: number
    leftWallVisible?: boolean
    rightWallVisible?: boolean
    additionalWalls?: Array<{
      id: string
      length: number
      distanceFromLeft: number
      thickness?: number
    }>
  }
  cabinets: SavedCabinet[]
  views: SavedView[]
  cabinetSyncs?: Array<{ cabinetId: string; syncedWith: string[] }>
}

/**
 * Generate a unique ID for a room.
 * Used for local state management.
 */
export function generateRoomId(): string {
  return `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
