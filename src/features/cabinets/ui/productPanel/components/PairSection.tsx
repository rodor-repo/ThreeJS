import React from 'react'
import { X } from 'lucide-react'

export interface GroupCabinet {
  cabinetId: string
  percentage: number
}

export interface CabinetInfo {
  cabinetId: string
  sortNumber?: number
}

export interface PairSectionProps {
  /** Selected cabinet info */
  selectedCabinet: CabinetInfo
  /** All cabinets in the current view */
  cabinetsInView: string[]
  /** All cabinets for display info */
  allCabinets: CabinetInfo[]
  /** Current group/pair configuration */
  groupCabinets: GroupCabinet[]
  /** Group change callback */
  onGroupChange: (group: GroupCabinet[]) => void
}

/**
 * Get display name for a cabinet
 */
function getCabinetDisplayName(cabinet: CabinetInfo | undefined, cabinetId: string): string {
  if (cabinet?.sortNumber) {
    return `#${cabinet.sortNumber}`
  }
  return `Cabinet ${cabinetId.slice(0, 8)}...`
}

/**
 * Pair section component for linking cabinets with percentage distribution
 */
export const PairSection: React.FC<PairSectionProps> = ({
  selectedCabinet,
  cabinetsInView,
  allCabinets,
  groupCabinets,
  onGroupChange
}) => {
  const handleAddCabinet = (cabinetToAdd: string) => {
    if (!cabinetToAdd || groupCabinets.find(g => g.cabinetId === cabinetToAdd)) {
      return
    }

    const newGroup = [...groupCabinets, { cabinetId: cabinetToAdd, percentage: 0 }]

    // Distribute percentages evenly
    const totalCabinets = newGroup.length
    const equalPercentage = 100 / totalCabinets
    const adjustedGroup = newGroup.map(g => ({
      ...g,
      percentage: Math.round(equalPercentage * 100) / 100
    }))

    // Ensure total is exactly 100%
    const total = adjustedGroup.reduce((sum, g) => sum + g.percentage, 0)
    if (total !== 100) {
      adjustedGroup[0].percentage += (100 - total)
    }

    onGroupChange(adjustedGroup)
  }

  const handlePercentageChange = (index: number, newPercentage: number) => {
    const updatedGroup = groupCabinets.map((g, i) =>
      i === index ? { ...g, percentage: Math.max(0, Math.min(100, newPercentage)) } : g
    )

    // Adjust other percentages to maintain 100% total
    const total = updatedGroup.reduce((sum, g) => sum + g.percentage, 0)
    if (total !== 100) {
      const diff = 100 - total
      const otherIndices = updatedGroup.map((_, i) => i).filter(i => i !== index)
      if (otherIndices.length > 0) {
        const perCabinet = diff / otherIndices.length
        otherIndices.forEach(i => {
          updatedGroup[i].percentage = Math.max(0, Math.min(100, updatedGroup[i].percentage + perCabinet))
        })
        // Final adjustment
        const finalTotal = updatedGroup.reduce((sum, g) => sum + g.percentage, 0)
        if (finalTotal !== 100) {
          updatedGroup[otherIndices[0]].percentage += (100 - finalTotal)
        }
      }
    }

    onGroupChange(updatedGroup)
  }

  const handleRemoveCabinet = (cabinetId: string) => {
    const remaining = groupCabinets.filter(g => g.cabinetId !== cabinetId)

    if (remaining.length > 0) {
      // Redistribute percentages to remaining cabinets
      const totalRemaining = remaining.reduce((sum, g) => sum + g.percentage, 0)
      const adjusted = remaining.map(g => ({
        ...g,
        percentage: totalRemaining > 0
          ? (g.percentage / totalRemaining) * 100
          : 100 / remaining.length
      }))

      // Ensure total is exactly 100%
      const finalTotal = adjusted.reduce((sum, g) => sum + g.percentage, 0)
      if (finalTotal !== 100) {
        adjusted[0].percentage += (100 - finalTotal)
      }

      onGroupChange(adjusted)
    } else {
      onGroupChange([])
    }
  }

  // Available cabinets (in view, not selected, not already in group)
  const availableCabinets = allCabinets.filter(c =>
    c.cabinetId !== selectedCabinet.cabinetId &&
    cabinetsInView.includes(c.cabinetId) &&
    !groupCabinets.find(g => g.cabinetId === c.cabinetId)
  )

  const totalPercentage = groupCabinets.reduce((sum, g) => sum + g.percentage, 0)

  return (
    <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
      <div className="flex items-center space-x-2 mb-2.5 text-gray-700 font-medium">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <h3>Pair</h3>
      </div>

      <div className="space-y-3">
        {/* Dropdown - auto-adds on selection */}
        <select
          className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value=""
          onChange={e => handleAddCabinet(e.target.value)}
        >
          <option value="">Select a cabinet to add...</option>
          {availableCabinets.map(cabinet => (
            <option key={cabinet.cabinetId} value={cabinet.cabinetId}>
              {getCabinetDisplayName(cabinet, cabinet.cabinetId)}
            </option>
          ))}
        </select>

        {/* Pair List */}
        {groupCabinets.length > 0 && (
          <div className="space-y-2">
            {groupCabinets.map((groupCabinet, index) => {
              const cabinet = allCabinets.find(c => c.cabinetId === groupCabinet.cabinetId)

              return (
                <div
                  key={groupCabinet.cabinetId}
                  className="flex items-center gap-2 p-2 bg-gray-50 rounded-md"
                >
                  <span className="flex-1 text-sm text-gray-700 truncate">
                    {getCabinetDisplayName(cabinet, groupCabinet.cabinetId)}
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-20 text-center text-sm px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={groupCabinet.percentage}
                    onChange={e => handlePercentageChange(index, parseFloat(e.target.value) || 0)}
                  />
                  <span className="text-sm text-gray-600">%</span>
                  <button
                    onClick={() => handleRemoveCabinet(groupCabinet.cabinetId)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                    title="Remove from pair"
                  >
                    <X size={16} />
                  </button>
                </div>
              )
            })}

            {/* Total Percentage Display */}
            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <span className="text-sm font-medium text-gray-700">Total:</span>
              <span className={`text-sm font-semibold ${totalPercentage === 100 ? 'text-green-600' : 'text-red-600'
                }`}>
                {totalPercentage.toFixed(2)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PairSection
