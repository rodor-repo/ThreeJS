import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, FolderOpen, Trash2, Calendar, Package, Loader2, CircleCheckBig } from "lucide-react"
import { useUserRoomsList, useDeleteUserRoom } from "@/hooks/useUserRoomsQuery"

interface UserRoomsModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectRoom: (roomId: string) => void
  userEmail?: string | null
}

export const UserRoomsModal: React.FC<UserRoomsModalProps> = ({
  isOpen,
  onClose,
  onSelectRoom,
  userEmail,
}) => {
  const normalizedEmail = userEmail?.toLowerCase().trim() || ""

  // React Query hooks
  const {
    data: rooms = [],
    isLoading,
    isError,
  } = useUserRoomsList(normalizedEmail, {
    enabled: isOpen && !!normalizedEmail,
  })

  const deleteRoomMutation = useDeleteUserRoom(normalizedEmail)

  const handleDelete = async (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation()

    if (!confirm("Are you sure you want to delete this saved room?")) return

    deleteRoomMutation.mutate(
      { roomId },
      {
        onError: (error) => {
          console.error("Failed to delete room:", error)
          alert("Failed to delete room. Please try again.")
        },
      }
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose()
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-AU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return dateString
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black bg-opacity-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-lg bg-white rounded-lg shadow-xl z-[101] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FolderOpen className="text-blue-600" size={24} />
                My Saved Rooms
              </h2>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Room List */}
            <div className="max-h-96 overflow-y-auto">
              {isError && (
                <div className="p-4 text-red-600 text-center">
                  Failed to load rooms. Please try again.
                </div>
              )}

              {isLoading && (
                <div className="p-8 text-center text-gray-500">
                  <Loader2 size={32} className="animate-spin mx-auto mb-2" />
                  Loading your rooms...
                </div>
              )}

              {!isLoading && !isError && rooms.length === 0 && normalizedEmail && (
                <div className="p-8 text-center text-gray-500">
                  <FolderOpen size={48} className="mx-auto mb-2 opacity-50" />
                  <p>No saved rooms found for your account.</p>
                  <p className="text-sm mt-1">
                    Rooms are saved automatically when you add items to cart.
                  </p>
                </div>
              )}

              {!isLoading && !isError && !normalizedEmail && (
                <div className="p-8 text-center text-gray-500">
                  <p>Sign in to view your saved rooms.</p>
                </div>
              )}

              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors flex items-center justify-between group"
                  onClick={() => onSelectRoom(room.id)}
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {room.name}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">
                      Template: {room.originalRoomName}
                    </p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Package size={12} />
                        {room.projectName || "No project"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {formatDate(room.updatedAt)}
                      </span>
                    </div>
                  </div>
                  {room.projectId ? (
                    <span
                      className="p-2 text-green-600"
                      title="Already in cart"
                      aria-label="Already in cart"
                    >
                      <CircleCheckBig size={16} />
                    </span>
                  ) : (
                    <button
                      onClick={(e) => handleDelete(e, room.id)}
                      disabled={deleteRoomMutation.isPending && deleteRoomMutation.variables?.roomId === room.id}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                      title="Delete room"
                    >
                      {deleteRoomMutation.isPending && deleteRoomMutation.variables?.roomId === room.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 text-center">
                Select a room to continue editing and adding to cart
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
