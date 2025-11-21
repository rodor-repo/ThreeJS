"use server"

import fs from 'fs/promises'
import path from 'path'
import type { SavedRoom, RoomCategory } from '@/data/savedRooms'

const ROOMS_DIR = path.join(process.cwd(), 'data', 'saved-rooms')

/**
 * Ensure the rooms directory exists
 */
async function ensureDirectory(): Promise<void> {
  try {
    await fs.mkdir(ROOMS_DIR, { recursive: true })
  } catch (error) {
    console.error('Failed to create rooms directory:', error)
    throw new Error('Failed to initialize rooms storage directory')
  }
}

/**
 * Get the file path for a room
 */
function getRoomFilePath(roomId: string): string {
  return path.join(ROOMS_DIR, `${roomId}.json`)
}

/**
 * Save a room to a JSON file
 */
export async function saveRoomToFile(room: SavedRoom): Promise<void> {
  try {
    await ensureDirectory()
    const filePath = getRoomFilePath(room.id)
    await fs.writeFile(filePath, JSON.stringify(room, null, 2), 'utf-8')
  } catch (error) {
    console.error('Failed to save room to file:', error)
    throw new Error(`Failed to save room: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get all rooms from files
 */
export async function getAllRoomsFromFiles(): Promise<SavedRoom[]> {
  try {
    await ensureDirectory()
    const files = await fs.readdir(ROOMS_DIR)
    const jsonFiles = files.filter(file => file.endsWith('.json'))
    
    const rooms: SavedRoom[] = []
    
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(ROOMS_DIR, file)
        const content = await fs.readFile(filePath, 'utf-8')
        const room: SavedRoom = JSON.parse(content)
        rooms.push(room)
      } catch (error) {
        console.error(`Failed to read room file ${file}:`, error)
        // Continue with other files even if one fails
      }
    }
    
    // Sort by savedAt date (newest first)
    return rooms.sort((a, b) => 
      new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    )
  } catch (error) {
    console.error('Failed to get all rooms from files:', error)
    return []
  }
}

/**
 * Get a room by ID from file
 */
export async function getRoomByIdFromFile(id: string): Promise<SavedRoom | null> {
  try {
    await ensureDirectory()
    const filePath = getRoomFilePath(id)
    const content = await fs.readFile(filePath, 'utf-8')
    const room: SavedRoom = JSON.parse(content)
    return room
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist
      return null
    }
    console.error(`Failed to get room ${id} from file:`, error)
    throw new Error(`Failed to read room: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get rooms by category from files
 */
export async function getRoomsByCategoryFromFiles(category: RoomCategory): Promise<SavedRoom[]> {
  try {
    const allRooms = await getAllRoomsFromFiles()
    return allRooms.filter(room => room.category === category)
  } catch (error) {
    console.error('Failed to get rooms by category from files:', error)
    return []
  }
}

/**
 * Delete a room file
 */
export async function deleteRoomFile(id: string): Promise<boolean> {
  try {
    await ensureDirectory()
    const filePath = getRoomFilePath(id)
    await fs.unlink(filePath)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist, consider it already deleted
      return true
    }
    console.error(`Failed to delete room ${id} file:`, error)
    return false
  }
}

/**
 * Check if a room with the same name and category exists
 */
export async function findRoomByNameAndCategory(
  name: string,
  category: RoomCategory
): Promise<SavedRoom | null> {
  try {
    const allRooms = await getAllRoomsFromFiles()
    return allRooms.find(
      room => room.name === name && room.category === category
    ) || null
  } catch (error) {
    console.error('Failed to find room by name and category:', error)
    return null
  }
}

