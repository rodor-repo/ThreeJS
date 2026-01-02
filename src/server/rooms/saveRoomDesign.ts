"use server"

import { getAdminDb, getCompanyId } from "@/server/firebase"
import { resolveRoomIdByUrl } from "@/server/rooms/resolveRoomId"
import type { SavedRoom } from "@/data/savedRooms"

/**
 * Save a room design to Firestore.
 *
 * Path: companies/{companyId}/settings/wsRooms/designs/{roomId}
 *
 * Uses set() with merge:true to handle both new and existing documents.
 * This allows saving to a room that was created in the control panel
 * but doesn't have a design document yet.
 *
 * @param roomUrl - The room URL slug (matches wsRooms.rooms.*.url)
 * @param design - The serialized room design data
 */
export async function saveRoomDesign(
  roomUrl: string,
  design: Omit<SavedRoom, "id" | "name" | "category">
): Promise<void> {
  if (!roomUrl) {
    throw new Error("roomUrl is required to save a design")
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

  // Use set with merge to handle both create and update
  await docRef.set(
    {
      ...design,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  )
}
