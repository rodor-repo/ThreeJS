"use server"

import { requireUserSession } from "@/lib/auth/server"
import { getAdminDb, getCompanyId } from "@/server/firebase"

/**
 * Delete a user room by ID.
 *
 * Path: companies/{companyId}/wsUserRooms/{userRoomId}
 *
 * Verifies ownership by checking session email before deletion.
 *
 * @returns Success status
 */
export async function deleteUserRoom(
  userRoomId: string
): Promise<{ success: boolean }> {
  const session = await requireUserSession()

  if (!userRoomId) {
    throw new Error("userRoomId is required")
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
  if (
    typeof data?.userEmail !== "string" ||
    data.userEmail.toLowerCase().trim() !== session.email.toLowerCase().trim()
  ) {
    throw new Error("Unauthorized: email mismatch")
  }

  await docRef.delete()
  return { success: true }
}
