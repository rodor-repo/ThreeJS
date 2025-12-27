import React from "react"

export type MergeType = "benchtop" | "kicker"

interface MergeButtonProps {
  isVisible: boolean
  mergeType: MergeType
  onMerge: () => void
}

/**
 * Merge button - appears when 2+ benchtops or kickers are selected
 * Positioned in the bottom left corner, to the right of the Save button
 */
export const MergeButton: React.FC<MergeButtonProps> = ({
  isVisible,
  mergeType,
  onMerge,
}) => {
  if (!isVisible) return null

  const label = mergeType === "benchtop" ? "MERGE BENCHTOPS" : "MERGE KICKERS"

  return (
    <button
      onClick={onMerge}
      className="fixed bottom-4 left-28 z-50 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-lg transition-colors duration-200 font-medium"
    >
      {label}
    </button>
  )
}

// Keep old export for backward compatibility
export const MergeBenchtopsButton = MergeButton

