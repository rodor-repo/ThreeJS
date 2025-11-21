import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

type RoomCategory = 'Kitchen' | 'Pantry' | 'Laundry' | 'Wardrobe' | 'Vanity' | 'TV Room' | 'Alfresco'

interface SaveModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (roomName: string, roomCategory: RoomCategory) => void
  currentRoom?: { name: string; category: RoomCategory } | null
}

export const SaveModal: React.FC<SaveModalProps> = ({ isOpen, onClose, onSave, currentRoom }) => {
  const [roomName, setRoomName] = useState('')
  const [roomCategory, setRoomCategory] = useState<RoomCategory>('Kitchen')

  const roomCategories: RoomCategory[] = ['Kitchen', 'Pantry', 'Laundry', 'Wardrobe', 'Vanity', 'TV Room', 'Alfresco']

  // Update form values when modal opens and currentRoom is available
  React.useEffect(() => {
    if (isOpen && currentRoom) {
      setRoomName(currentRoom.name)
      setRoomCategory(currentRoom.category)
    } else if (isOpen && !currentRoom) {
      // Reset to defaults if no room is loaded
      setRoomName('')
      setRoomCategory('Kitchen')
    }
  }, [isOpen, currentRoom])

  const handleSave = () => {
    if (!roomName.trim()) {
      alert('Please enter a room name')
      return
    }
    onSave(roomName.trim(), roomCategory)
    setRoomName('')
    setRoomCategory('Kitchen')
    onClose()
  }

  const handleClose = () => {
    setRoomName('')
    setRoomCategory('Kitchen')
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black bg-opacity-50 z-[100]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-lg shadow-xl z-[101]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">Save Room</h2>
              <button
                onClick={handleClose}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="roomName" className="block text-sm font-medium text-gray-700 mb-2">
                  Room Name
                </label>
                <input
                  type="text"
                  id="roomName"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Enter room name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="roomCategory" className="block text-sm font-medium text-gray-700 mb-2">
                  Room Category
                </label>
                <select
                  id="roomCategory"
                  value={roomCategory}
                  onChange={(e) => setRoomCategory(e.target.value as RoomCategory)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {roomCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Save
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

