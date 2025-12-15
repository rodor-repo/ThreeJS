/**
 * Saved Rooms Data Storage
 * This file defines types and interfaces for saved room configurations.
 * Actual storage is handled by server actions in src/server/roomStorage.ts
 */

export type RoomCategory = 'Kitchen' | 'Pantry' | 'Laundry' | 'Wardrobe' | 'Vanity' | 'TV Room' | 'Alfresco'

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
  materialSelections?: Record<string, { priceRangeId: string, colorId: string, finishId?: string }>
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
  parentSide?: 'left' | 'right'
  /** Flag to hide lock icons - used for fillers/panels added from modal */
  hideLockIcons?: boolean
  /** For kicker type: parent cabinet ID that this kicker belongs to */
  kickerParentCabinetId?: string
  /** For bulkhead type: parent cabinet ID that this bulkhead belongs to */
  bulkheadParentCabinetId?: string
  /** For underPanel type: parent cabinet ID that this under panel belongs to */
  underPanelParentCabinetId?: string
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
  cabinetSyncs?: Array<{ cabinetId: string, syncedWith: string[] }>
}

import { CabinetType } from '@/features/carcass'
// Import server actions for file storage
import {
  saveRoomToFile,
  getAllRoomsFromFiles,
  getRoomsByCategoryFromFiles,
  getRoomByIdFromFile,
  deleteRoomFile,
  findRoomByNameAndCategory,
} from '@/server/roomStorage'

/**
 * Save a room configuration to file storage
 * If a room with the same name and category exists, it will be updated
 */
export async function saveRoom(room: SavedRoom): Promise<void> {
  // Check if room with same name and category already exists
  const existingRoom = await findRoomByNameAndCategory(room.name, room.category)
  
  if (existingRoom) {
    // Update existing room by using its ID
    const updatedRoom: SavedRoom = {
      ...room,
      id: existingRoom.id, // Keep the original ID
    }
    await saveRoomToFile(updatedRoom)
  } else {
    // Save new room
    await saveRoomToFile(room)
  }
}

/**
 * Get all saved rooms from file storage
 */
export async function getAllSavedRooms(): Promise<SavedRoom[]> {
  return await getAllRoomsFromFiles()
}

/**
 * Get saved rooms by category from file storage
 */
export async function getSavedRoomsByCategory(category: RoomCategory): Promise<SavedRoom[]> {
  return await getRoomsByCategoryFromFiles(category)
}

/**
 * Get a saved room by ID from file storage
 */
export async function getSavedRoomById(id: string): Promise<SavedRoom | undefined> {
  const room = await getRoomByIdFromFile(id)
  return room || undefined
}

/**
 * Delete a saved room by ID from file storage
 */
export async function deleteSavedRoom(id: string): Promise<boolean> {
  return await deleteRoomFile(id)
}

/**
 * Generate a unique ID for a room
 */
export function generateRoomId(): string {
  return `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

