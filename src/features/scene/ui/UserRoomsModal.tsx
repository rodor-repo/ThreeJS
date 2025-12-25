import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, FolderOpen, Trash2, Calendar, Package, Search, Loader2 } from "lucide-react"
import { useUserRoomsList, useDeleteUserRoom } from "@/hooks/useUserRoomsQuery"

interface UserRoomsModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectRoom: (roomId: string) => void
}

export const UserRoomsModal: React.FC<UserRoomsModalProps> = ({
  isOpen,
  onClose,
  onSelectRoom,
}) => {
  const [email, setEmail] = useState("")
  const [searchEmail, setSearchEmail] = useState("") // Email to search for (triggers query)

  // Load email from localStorage when modal opens
  useEffect(() => {
    if (isOpen) {
      const savedEmail = localStorage.getItem("userEmail")
      if (savedEmail) {
        setEmail(savedEmail)
        setSearchEmail(savedEmail)
      }
    }
  }, [isOpen])

  // React Query hooks
  const {
    data: rooms = [],
    isLoading,
    isError,
    refetch,
  } = useUserRoomsList(searchEmail, {
    enabled: isOpen && searchEmail.includes("@"),
  })

  const deleteRoomMutation = useDeleteUserRoom()

  const handleSearch = () => {
    if (!email.includes("@")) return
    localStorage.setItem("userEmail", email)
    setSearchEmail(email)
  }

  const handleDelete = async (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation()

    if (!confirm("Are you sure you want to delete this saved room?")) return

    deleteRoomMutation.mutate(
      { roomId, email: searchEmail },
      {
        onError: (error) => {
          console.error("Failed to delete room:", error)
          alert("Failed to delete room. Please try again.")
        },
      }
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && email.includes("@") && !isLoading) {
      handleSearch()
    }
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

            {/* Email Input */}
            <div className="p-4 border-b border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Email
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your email..."
                  autoFocus={!email}
                />
                <button
                  onClick={handleSearch}
                  disabled={isLoading || !email.includes("@")}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Search size={16} />
                  )}
                  {isLoading ? "Loading..." : "Search"}
                </button>
              </div>
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

              {!isLoading && !isError && rooms.length === 0 && searchEmail && (
                <div className="p-8 text-center text-gray-500">
                  <FolderOpen size={48} className="mx-auto mb-2 opacity-50" />
                  <p>No saved rooms found for this email.</p>
                  <p className="text-sm mt-1">
                    Rooms are saved automatically when you add items to cart.
                  </p>
                </div>
              )}

              {!isLoading && !isError && !searchEmail && (
                <div className="p-8 text-center text-gray-500">
                  <p>Enter your email to view saved rooms.</p>
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
                  <button
                    onClick={(e) => handleDelete(e, room.id)}
                    disabled={deleteRoomMutation.isPending && deleteRoomMutation.variables?.roomId === room.id}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    title="Delete room"
                  >
                    {deleteRoomMutation.isPending && deleteRoomMutation.variables?.roomId === room.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
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
