"use server"

import { cookies } from "next/headers"
import { USER_SESSION_COOKIE_NAME } from "@/lib/auth/constants"
import { verifyRoomSessionToken } from "@/lib/auth/session"
import { getAdminDb, getCompanyId } from "@/server/firebase"
import type { UserRoomListItem, RoomCategory } from "@/types/roomTypes"

/**
 * Get a list of user's saved rooms.
 *
 * Path: companies/{companyId}/wsUserRooms (query by userEmail)
 *
 * Returns minimal data for list display, sorted by updatedAt desc (client-side).
 * Uses .select() for better performance by only fetching needed fields.
 *
 * @returns Array of user room list items
 */
export async function getUserRoomsList(): Promise<UserRoomListItem[]> {
  const cookieStore = cookies()
  const sessionToken = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value
  if (!sessionToken) {
    throw new Error("AUTH_REQUIRED")
  }

  const session = await verifyRoomSessionToken(sessionToken)
  if (!session) {
    throw new Error("AUTH_REQUIRED")
  }

  const normalizedEmail = session.email.toLowerCase().trim()

  const db = getAdminDb()
  const companyId = getCompanyId()

  const collectionRef = db
    .collection("companies")
    .doc(companyId)
    .collection("wsUserRooms")

  // Query by email only (no orderBy to avoid needing a composite index)
  // Uses .select() to only fetch the fields we need for the list view
  const querySnapshot = await collectionRef
    .where("userEmail", "==", normalizedEmail)
    .select(
      "name",
      "originalRoomName",
      "projectName",
      "projectId",
      "updatedAt",
      "createdAt",
      "category"
    )
    .get()

  const rooms = querySnapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      id: doc.id,
      name: data.name || `Room ${doc.id.slice(-6)}`,
      originalRoomName: data.originalRoomName || "Unknown Template",
      projectName: data.projectName || "",
      projectId: data.projectId,
      updatedAt: data.updatedAt || data.createdAt || "",
      category: (data.category as RoomCategory) || "Kitchen",
    }
  })

  // Sort by updatedAt descending (most recent first) - client-side sort
  return rooms.sort((a, b) => {
    const dateA = new Date(a.updatedAt).getTime() || 0
    const dateB = new Date(b.updatedAt).getTime() || 0
    return dateB - dateA
  })
}
