"use server"

import { getAdminDb, getCompanyId } from "@/server/firebase"
import type { SavedRoom } from "@/data/savedRooms"

/**
 * Room design data as stored in Firestore.
 * Excludes id/name/category which come from wsRooms.rooms instead.
 */
export type RoomDesignData = Omit<SavedRoom, "id" | "name" | "category"> & {
  updatedAt?: string
}

/**
 * Get a room design from Firestore.
 *
 * Path: companies/{companyId}/settings/wsRooms/designs/{roomId}
 *
 * Returns null if the design document doesn't exist yet.
 * This is expected for newly created rooms that haven't been edited.
 *
 * @param roomId - The room ID (matches an entry in wsRooms.rooms)
 * @returns The room design data or null if not found
 */
export async function getRoomDesign(
  roomId: string
): Promise<RoomDesignData | null> {
  if (!roomId) {
    throw new Error("roomId is required to get a design")
  }

  const db = getAdminDb()
  const companyId = getCompanyId()

  const docRef = db
    .collection("companies")
    .doc(companyId)
    .collection("settings")
    .doc("wsRooms")
    .collection("designs")
    .doc(roomId)

  const docSnap = await docRef.get()

  if (!docSnap.exists) {
    return null
  }

  return docSnap.data() as RoomDesignData
}
