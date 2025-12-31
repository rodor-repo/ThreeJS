"use server"

import { getAdminDb, getCompanyId } from "@/server/firebase"
import { createSwrCache } from "@/server/swrCache"
import type { WsRooms } from "@/types/erpTypes"

const wsRoomsCache = createSwrCache<WsRooms>({
  maxEntries: 1,
  ttlMs: 5 * 60 * 1000,
})

/**
 * Fetch the wsRooms configuration document from Firestore.
 *
 * Path: companies/{companyId}/settings/wsRooms
 *
 * This document contains:
 * - categories: Room categories (Kitchen, Pantry, etc.)
 * - rooms: Pre-created room entries (created in control panel)
 * - tags: Room tags for filtering
 * - properties: Room properties
 */
export async function getWsRooms(): Promise<WsRooms> {
  const db = getAdminDb()
  const companyId = getCompanyId()

  return wsRoomsCache.get(`wsRooms:${companyId}`, async () => {
    const docRef = db
      .collection("companies")
      .doc(companyId)
      .collection("settings")
      .doc("wsRooms")
    const docSnap = await docRef.get()

    if (!docSnap.exists) {
      throw new Error(`wsRooms document not found for company ${companyId}`)
    }

    const data = docSnap.data() as WsRooms

    return data
  })
}
