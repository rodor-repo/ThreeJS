"use server"

import { getAdminDb, getCompanyId } from "@/server/firebase"
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
 * @param roomId - The room ID (matches an entry in wsRooms.rooms)
 * @param design - The serialized room design data
 */
export async function saveRoomDesign(
  roomId: string,
  design: Omit<SavedRoom, "id" | "name" | "category">
): Promise<void> {
  if (!roomId) {
    throw new Error("roomId is required to save a design")
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

  // Use set with merge to handle both create and update
  await docRef.set(
    {
      ...design,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  )
}
