/**
 * Migration Script: Local File Storage to Firebase
 * 
 * This script reads all saved rooms from the local data/saved-rooms/ folder
 * and migrates them to Firebase Firestore.
 * 
 * Usage:
 * 1. Set up Firebase configuration (see instructions below)
 * 2. Run: npx tsx src/scripts/migrateToFirebase.ts
 * 
 * Prerequisites:
 * - Firebase project created
 * - Firebase Admin SDK or Firebase client SDK configured
 * - Environment variables set (see below)
 */

import fs from 'fs/promises'
import path from 'path'
import type { SavedRoom } from '@/types/roomTypes'

const ROOMS_DIR = path.join(process.cwd(), 'data', 'saved-rooms')

/**
 * Read all room files from local storage
 */
async function getAllLocalRooms(): Promise<SavedRoom[]> {
  try {
    const files = await fs.readdir(ROOMS_DIR)
    const jsonFiles = files.filter(file => file.endsWith('.json'))
    
    const rooms: SavedRoom[] = []
    
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(ROOMS_DIR, file)
        const content = await fs.readFile(filePath, 'utf-8')
        const room: SavedRoom = JSON.parse(content)
        rooms.push(room)
        console.log(`✓ Read room: ${room.name} (${room.id})`)
      } catch (error) {
        console.error(`✗ Failed to read ${file}:`, error)
      }
    }
    
    return rooms
  } catch (error) {
    console.error('Failed to read rooms directory:', error)
    return []
  }
}

/**
 * Migrate rooms to Firebase Firestore
 * 
 * TODO: Implement Firebase migration logic
 * 
 * Option 1: Using Firebase Admin SDK (Server-side)
 * ```typescript
 * import admin from 'firebase-admin'
 * 
 * // Initialize Firebase Admin
 * const serviceAccount = require('./path/to/serviceAccountKey.json')
 * admin.initializeApp({
 *   credential: admin.credential.cert(serviceAccount)
 * })
 * 
 * const db = admin.firestore()
 * 
 * async function migrateToFirebase(rooms: SavedRoom[]) {
 *   const batch = db.batch()
 *   
 *   for (const room of rooms) {
 *     const roomRef = db.collection('rooms').doc(room.id)
 *     batch.set(roomRef, {
 *       ...room,
 *       savedAt: admin.firestore.Timestamp.fromDate(new Date(room.savedAt)),
 *       migratedAt: admin.firestore.FieldValue.serverTimestamp()
 *     })
 *   }
 *   
 *   await batch.commit()
 *   console.log(`✓ Migrated ${rooms.length} rooms to Firebase`)
 * }
 * ```
 * 
 * Option 2: Using Firebase Client SDK (if you have authentication)
 * ```typescript
 * import { initializeApp } from 'firebase/app'
 * import { getFirestore, collection, doc, setDoc } from 'firebase/firestore'
 * 
 * const firebaseConfig = {
 *   apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
 *   authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
 *   projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
 *   // ... other config
 * }
 * 
 * const app = initializeApp(firebaseConfig)
 * const db = getFirestore(app)
 * 
 * async function migrateToFirebase(rooms: SavedRoom[]) {
 *   for (const room of rooms) {
 *     await setDoc(doc(db, 'rooms', room.id), {
 *       ...room,
 *       savedAt: new Date(room.savedAt),
 *       migratedAt: new Date()
 *     })
 *     console.log(`✓ Migrated: ${room.name}`)
 *   }
 * }
 * ```
 */
async function migrateToFirebase(rooms: SavedRoom[]): Promise<void> {
  console.log('\n📦 Starting migration to Firebase...')
  console.log(`Found ${rooms.length} rooms to migrate\n`)
  
  // TODO: Implement actual Firebase migration
  // For now, just log what would be migrated
  console.log('Rooms to migrate:')
  rooms.forEach((room, index) => {
    console.log(`${index + 1}. ${room.name} (${room.category}) - ${room.cabinets.length} cabinets`)
  })
  
  console.log('\n⚠️  Firebase migration not yet implemented.')
  console.log('Please implement the migrateToFirebase function using one of the options above.')
  console.log('See comments in this file for implementation details.\n')
}

/**
 * Main migration function
 */
async function main() {
  try {
    console.log('🚀 Starting room migration process...\n')
    
    // Step 1: Read all local rooms
    console.log('Step 1: Reading local room files...')
    const rooms = await getAllLocalRooms()
    
    if (rooms.length === 0) {
      console.log('No rooms found to migrate.')
      return
    }
    
    console.log(`✓ Found ${rooms.length} room(s)\n`)
    
    // Step 2: Migrate to Firebase
    console.log('Step 2: Migrating to Firebase...')
    await migrateToFirebase(rooms)
    
    console.log('\n✅ Migration process completed!')
    console.log('\nNote: After successful migration, you can:')
    console.log('1. Update your code to use Firebase instead of file storage')
    console.log('2. Optionally archive or delete local room files')
    console.log('3. Test loading rooms from Firebase')
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  main()
}

export { getAllLocalRooms, migrateToFirebase }

