"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import type { UserSavedRoom } from "@/data/savedRooms"

interface UserRoomContextType {
  /** Currently loaded user room (null if loading admin template) */
  currentUserRoom: UserSavedRoom | null
  /** Set when loading a user room */
  setCurrentUserRoom: (room: UserSavedRoom | null) => void
  /** Clear user room context (return to admin template mode) */
  clearUserRoom: () => void
  /** Is currently editing a user room vs admin template */
  isUserRoomMode: boolean
  /** Update current user room with new data (e.g., after saving) */
  updateUserRoom: (updates: Partial<UserSavedRoom>) => void
}

const UserRoomContext = createContext<UserRoomContextType | null>(null)

export function UserRoomProvider({ children }: { children: ReactNode }) {
  const [currentUserRoom, setCurrentUserRoom] = useState<UserSavedRoom | null>(null)

  const clearUserRoom = useCallback(() => {
    setCurrentUserRoom(null)
  }, [])

  const updateUserRoom = useCallback((updates: Partial<UserSavedRoom>) => {
    setCurrentUserRoom((prev) => {
      if (!prev) return null
      return { ...prev, ...updates }
    })
  }, [])

  return (
    <UserRoomContext.Provider
      value={{
        currentUserRoom,
        setCurrentUserRoom,
        clearUserRoom,
        isUserRoomMode: currentUserRoom !== null,
        updateUserRoom,
      }}
    >
      {children}
    </UserRoomContext.Provider>
  )
}

export function useUserRoom() {
  const context = useContext(UserRoomContext)
  if (!context) {
    throw new Error("useUserRoom must be used within UserRoomProvider")
  }
  return context
}
