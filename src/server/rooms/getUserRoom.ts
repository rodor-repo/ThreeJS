"use server"

import { cookies } from "next/headers"
import { USER_SESSION_COOKIE_NAME } from "@/lib/auth/constants"
import { verifyRoomSessionToken } from "@/lib/auth/session"
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
  if (!userRoomId) {
    throw new Error("userRoomId is required to get user room")
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
