"use server"

import { requireUserSession } from "@/lib/auth/server"
import { getAdminDb, getCompanyId } from "@/server/firebase"
import type { UserSavedRoom } from "@/types/roomTypes"

/**
 * Get full user room data by ID.
 *
 * Path: companies/{companyId}/wsUserRooms/{userRoomId}
 *
 * @param userRoomId - The user room document ID
 * @returns The full user room data or null if not found
 */
export async function getUserRoom(
  userRoomId: string
): Promise<UserSavedRoom | null> {
  const session = await requireUserSession()

  if (!userRoomId) {
    throw new Error("userRoomId is required to get user room")
  }

  const db = getAdminDb()
  const companyId = getCompanyId()

  const docRef = db
    .collection("companies")
    .doc(companyId)
    .collection("wsUserRooms")
    .doc(userRoomId)

  const docSnap = await docRef.get()

  if (!docSnap.exists) {
    return null
  }

  const data = docSnap.data()
  const ownerEmail = data?.userEmail
  if (
    typeof ownerEmail !== "string" ||
    ownerEmail.toLowerCase().trim() !== session.email.toLowerCase().trim()
  ) {
    throw new Error("UNAUTHORIZED")
  }

  return {
    id: docSnap.id,
    ...data,
  } as UserSavedRoom
}
