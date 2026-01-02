"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getUserRoomsList } from "@/server/rooms/getUserRoomsList"
import { getUserRoom } from "@/server/rooms/getUserRoom"
import { saveUserRoom, SaveUserRoomData } from "@/server/rooms/saveUserRoom"
import { deleteUserRoom } from "@/server/rooms/deleteUserRoom"
import type { UserRoomListItem, UserSavedRoom } from "@/types/roomTypes"

/**
 * React Query keys for user rooms data
 */
export const userRoomsQueryKeys = {
  all: ["userRooms"] as const,
  list: (email: string) =>
    ["userRooms", "list", email.toLowerCase().trim()] as const,
  detail: (id: string) => ["userRooms", "detail", id] as const,
}

/**
 * Hook for fetching a user's saved rooms list.
 *
 * @param email - User email to query rooms for
 * @param options - Optional query options
 * @returns React Query result with rooms list
 */
export function useUserRoomsList(
  email: string,
  options?: { enabled?: boolean }
) {
  const normalizedEmail = email?.toLowerCase().trim() || ""
  const isValidEmail = normalizedEmail.includes("@")

  return useQuery<UserRoomListItem[], Error>({
    queryKey: userRoomsQueryKeys.list(normalizedEmail),
    queryFn: async () => {
      const data = await getUserRoomsList(normalizedEmail)
      return data
    },
    enabled: isValidEmail && (options?.enabled ?? true),
    staleTime: 2 * 60 * 1000, // 2 minutes - user rooms change more frequently
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
  })
}

/**
 * Mutation hook for saving a user room.
 *
 * On success, invalidates the rooms list for the user's email.
 *
 * @returns Mutation result with save function
 */
export function useSaveUserRoom() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SaveUserRoomData) => {
      const result = await saveUserRoom(input)
      return result
    },
    onSuccess: (_, variables) => {
      // Invalidate the rooms list for this user
      queryClient.invalidateQueries({
        queryKey: userRoomsQueryKeys.list(variables.userEmail),
      })
    },
  })
}

/**
 * Mutation hook for deleting a user room.
 *
 * Optimistically removes the room from the list cache.
 *
 * @returns Mutation result with delete function
 */
export function useDeleteUserRoom() {
  const queryClient = useQueryClient()

  type DeleteVariables = { roomId: string; email: string }
  type DeleteContext = { previousRooms?: UserRoomListItem[] }
  type DeleteResult = { success: boolean }

  return useMutation<DeleteResult, Error, DeleteVariables, DeleteContext>({
    mutationFn: async ({ roomId, email }) => {
      const result = await deleteUserRoom(roomId, email)
      return result
    },
    onMutate: async ({ roomId, email }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: userRoomsQueryKeys.list(email),
      })

      // Snapshot previous value
      const previousRooms = queryClient.getQueryData<UserRoomListItem[]>(
        userRoomsQueryKeys.list(email)
      )

      // Optimistically update cache
      if (previousRooms) {
        queryClient.setQueryData<UserRoomListItem[]>(
          userRoomsQueryKeys.list(email),
          previousRooms.filter((room) => room.id !== roomId)
        )
      }

      return { previousRooms }
    },
    onError: (_err, variables, context) => {
      // Rollback on error
      if (context?.previousRooms) {
        queryClient.setQueryData(
          userRoomsQueryKeys.list(variables.email),
          context.previousRooms
        )
      }
    },
    onSettled: (_data, _error, variables) => {
      // Refetch after error or success
      if (variables) {
        queryClient.invalidateQueries({
          queryKey: userRoomsQueryKeys.list(variables.email),
        })
      }
    },
  })
}

/**
 * Mutation hook for loading a specific user room.
 *
 * Uses mutation since it's an imperative on-demand action.
 *
 * @returns Mutation result with load function
 */
export function useLoadUserRoom() {
  return useMutation<UserSavedRoom | null, Error, string>({
    mutationFn: async (roomId) => {
      const room = await getUserRoom(roomId)
      return room
    },
  })
}
