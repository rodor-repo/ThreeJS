import React from 'react'
import { RefreshCw } from 'lucide-react'

export interface CabinetInfo {
  cabinetId: string
  sortNumber?: number
}

export interface SyncSectionProps {
  /** Selected cabinet info */
  selectedCabinet: CabinetInfo
  /** All cabinets in the current view */
  cabinetsInView: string[]
  /** All cabinets for display info */
  allCabinets: CabinetInfo[]
  /** Currently synced cabinet IDs */
  syncCabinets: string[]
  /** Sync change callback */
  onSyncChange: (syncList: string[]) => void
  /** If true, renders only inner content without card wrapper */
  noWrapper?: boolean
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
 * Sync section component for syncing dimension changes across cabinets
 */
export const SyncSection: React.FC<SyncSectionProps> = ({
  selectedCabinet,
  cabinetsInView,
  allCabinets,
  syncCabinets,
  onSyncChange,
  noWrapper = false,
}) => {
  // Available cabinets (in view, not the selected cabinet)
  const availableCabinets = allCabinets.filter(c =>
    c.cabinetId !== selectedCabinet.cabinetId &&
    cabinetsInView.includes(c.cabinetId)
  )

  const handleToggleSync = (cabinetId: string, checked: boolean) => {
    const newSyncList = checked
      ? [...syncCabinets, cabinetId]
      : syncCabinets.filter(id => id !== cabinetId)
    onSyncChange(newSyncList)
  }

  if (availableCabinets.length === 0) {
    const emptyContent = <p className="text-sm text-gray-500 italic">No other cabinets in this view</p>
    
    if (noWrapper) {
      return emptyContent
    }
    
    return (
      <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
        <div className="flex items-center space-x-2 mb-2.5 text-gray-700 font-medium">
          <RefreshCw size={20} />
          <h3>Sync</h3>
        </div>
        {emptyContent}
      </div>
    )
  }

  const content = (
    <div className="max-h-48 overflow-y-auto space-y-2">
      {availableCabinets.map(cabinet => {
        const isSynced = syncCabinets.includes(cabinet.cabinetId)
        const displayName = getCabinetDisplayName(cabinet, cabinet.cabinetId)

        return (
          <label
            key={cabinet.cabinetId}
            className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${isSynced
                ? 'bg-blue-50 border border-blue-200'
                : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
              }`}
          >
            <input
              type="checkbox"
              checked={isSynced}
              onChange={e => handleToggleSync(cabinet.cabinetId, e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className={`flex-1 text-sm truncate ${isSynced ? 'text-blue-700 font-medium' : 'text-gray-700'
              }`}>
              {displayName}
            </span>
            {isSynced && <RefreshCw size={14} className="text-blue-500" />}
          </label>
        )
      })}
    </div>
  )

  if (noWrapper) {
    return content
  }

  return (
    <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
      <div className="flex items-center space-x-2 mb-2.5 text-gray-700 font-medium">
        <RefreshCw size={20} />
        <h3>Sync</h3>
      </div>
      {content}
    </div>
  )
}

export default SyncSection
