"use server"

import { requireUserSession } from "@/lib/auth/server"
import { getAdminDb, getCompanyId } from "@/server/firebase"
import type { UserSavedRoom } from "@/types/roomTypes"

/**
 * Data required to save a user room.
 * Omits 'id' since Firestore generates it for new documents.
 */
export type SaveUserRoomData = Omit<
  UserSavedRoom,
  "id" | "createdAt" | "userEmail"
> & {
  /** Optional: existing user room ID for updates */
  userRoomId?: string
}

export interface SaveUserRoomResult {
  success: true
  userRoomId: string
}

/**
 * Save a user room configuration to Firestore using the session email.
 *
 * Path: companies/{companyId}/wsUserRooms/{userRoomId}
 *
 * If userRoomId is provided, updates the existing document.
 * Otherwise, creates a new document with auto-generated ID.
 *
 * @param data - The user room data to save
 * @returns The saved user room ID
 */
export async function saveUserRoom(
  data: SaveUserRoomData
): Promise<SaveUserRoomResult> {
  const session = await requireUserSession()

  if (!data.originalRoomId) {
    throw new Error("originalRoomId is required to save a user room")
  }

  const db = getAdminDb()
  const companyId = getCompanyId()

  const collectionRef = db
    .collection("companies")
    .doc(companyId)
    .collection("wsUserRooms")

  const now = new Date().toISOString()
  const { userRoomId, ...roomData } = data

  const normalizedData = {
    ...roomData,
    userEmail: session.email.toLowerCase().trim(),
  }

  if (userRoomId) {
    // Update existing document
    const docRef = collectionRef.doc(userRoomId)
    await docRef.update({
      ...normalizedData,
      updatedAt: now,
    })
    return { success: true, userRoomId }
  } else {
    // Create new document with auto-generated ID
    const docRef = await collectionRef.add({
      ...normalizedData,
      createdAt: now,
      updatedAt: now,
    })
    return { success: true, userRoomId: docRef.id }
  }
}
