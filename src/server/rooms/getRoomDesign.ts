"use server"

import { getAdminDb, getCompanyId } from "@/server/firebase"
import { resolveRoomIdByUrl } from "@/server/rooms/resolveRoomId"
import type { SavedRoom } from "@/types/roomTypes"

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
 * @param roomUrl - The room URL slug (matches wsRooms.rooms.*.url)
 * @returns The room design data or null if not found
 */
export async function getRoomDesign(
  roomUrl: string
): Promise<RoomDesignData | null> {
  if (!roomUrl) {
    throw new Error("roomUrl is required to get a design")
  }

  const db = getAdminDb()
  const companyId = getCompanyId()
  const roomId = await resolveRoomIdByUrl(roomUrl)

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
