"use server"

import { getAdminDb, getCompanyId } from "@/server/firebase"

/**
 * Delete a user room by ID.
 *
 * Path: companies/{companyId}/wsUserRooms/{userRoomId}
 *
 * Verifies ownership by checking email before deletion.
 *
 * @param userRoomId - The user room document ID
 * @param userEmail - The user's email (for verification)
 * @returns Success status
 */
export async function deleteUserRoom(
  userRoomId: string,
  userEmail: string
): Promise<{ success: boolean }> {
  if (!userRoomId || !userEmail) {
    throw new Error("userRoomId and userEmail are required")
  }

  const db = getAdminDb()
  const companyId = getCompanyId()

  const docRef = db
    .collection("companies")
    .doc(companyId)
    .collection("wsUserRooms")
    .doc(userRoomId)

  // Verify ownership before delete
  const doc = await docRef.get()
  if (!doc.exists) {
    return { success: false }
  }

  const data = doc.data()
  if (data?.userEmail?.toLowerCase() !== userEmail.toLowerCase().trim()) {
    throw new Error("Unauthorized: email mismatch")
  }

  await docRef.delete()
  return { success: true }
}
