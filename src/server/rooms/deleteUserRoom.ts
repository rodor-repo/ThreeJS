"use server"

import { cookies } from "next/headers"
import { USER_SESSION_COOKIE_NAME } from "@/lib/auth/constants"
import { verifyRoomSessionToken } from "@/lib/auth/session"
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
  if (!userRoomId) {
    throw new Error("userRoomId is required")
  }

  const cookieStore = cookies()
  const sessionToken = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value
  if (!sessionToken) {
    throw new Error("AUTH_REQUIRED")
  }

  const session = await verifyRoomSessionToken(sessionToken)
  if (!session) {
    throw new Error("AUTH_REQUIRED")
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
