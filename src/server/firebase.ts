/**
 * Firebase Admin SDK Initialization
 *
 * This module initializes the Firebase Admin SDK for server-side Firestore access.
 * NOT a server action - this is a utility module that exports the Firestore instance.
 *
 * Environment Variables Required:
 * - FB_ERP_PROJECT_ID
 * - FB_ERP_CLIENT_EMAIL
 * - FB_ERP_PRIVATE_KEY
 */

import { initializeApp, getApps, cert, type App } from "firebase-admin/app"
import { getFirestore, type Firestore } from "firebase-admin/firestore"

let app: App | undefined
let db: Firestore | undefined

function getFirebaseApp(): App {
  if (app) return app

  // Prevent re-initialization in development (hot reload)
  const existingApps = getApps()
  if (existingApps.length > 0) {
    app = existingApps[0]
    return app
  }

  const projectId = process.env.FB_ERP_PROJECT_ID
  const clientEmail = process.env.FB_ERP_CLIENT_EMAIL
  const privateKey = process.env.FB_ERP_PRIVATE_KEY

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Required: FB_ERP_PROJECT_ID, FB_ERP_CLIENT_EMAIL, FB_ERP_PRIVATE_KEY"
    )
  }

  app = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      // Handle escaped newlines in the private key
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
  })

  return app
}

/**
 * Get the Firestore database instance.
 * Initializes Firebase Admin SDK on first call.
 */
export function getAdminDb(): Firestore {
  if (db) return db

  getFirebaseApp()
  db = getFirestore()

  return db
}

/**
 * Company ID for Firestore paths.
 * Uses NEXT_PUBLIC_CABINETWORX_COMPANY_ID environment variable.
 */
export function getCompanyId(): string {
  const companyId = process.env.NEXT_PUBLIC_CABINETWORX_COMPANY_ID

  if (!companyId) {
    throw new Error(
      "Missing NEXT_PUBLIC_CABINETWORX_COMPANY_ID environment variable"
    )
  }

  return companyId
}
