import React from "react"

interface ModeToggleProps {
  selectedMode: "admin" | "user"
  onModeChange: (mode: "admin" | "user") => void
}

export const ModeToggle: React.FC<ModeToggleProps> = ({ selectedMode, onModeChange }) => {
  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex gap-3 z-10">
      <label className="relative cursor-pointer">
        <input
          type="radio"
          name="mode"
          value="admin"
          checked={selectedMode === "admin"}
          onChange={(e) => onModeChange(e.target.value as "admin" | "user")}
          className="sr-only"
        />
        <div
          className={`px-6 py-2 rounded-lg shadow-lg transition-colors duration-200 font-medium ${
            selectedMode === "admin" ? "bg-red-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Admin
        </div>
      </label>
      <label className="relative cursor-pointer">
        <input
          type="radio"
          name="mode"
          value="user"
          checked={selectedMode === "user"}
          onChange={(e) => onModeChange(e.target.value as "admin" | "user")}
          className="sr-only"
        />
        <div
          className={`px-6 py-2 rounded-lg shadow-lg transition-colors duration-200 font-medium ${
            selectedMode === "user" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          User
        </div>
      </label>
    </div>
  )
}

