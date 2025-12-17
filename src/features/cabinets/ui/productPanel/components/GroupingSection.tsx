import React from 'react'
import { Eye, Users, RefreshCw } from 'lucide-react'
import type { CabinetData } from '@/features/scene/types'
import type { GroupCabinet } from './PairSection'
import { PairSection } from './PairSection'
import { SyncSection } from './SyncSection'
import { CollapsibleSection } from './CollapsibleSection'
import { View, ViewId } from '@/features/cabinets/ViewManager'
import { ViewSelector } from '../../ViewSelector'

export interface GroupingSectionProps {
  /** View manager data */
  viewManager: {
    activeViews: View[]
    getCabinetsInView: (viewId: ViewId) => string[]
    assignCabinetToView: (cabinetId: string, viewId: ViewId | 'none') => void
    createView: () => View
  }
  /** Selected cabinet data */
  selectedCabinet: {
    cabinetId: string
    sortNumber?: number
    viewId?: ViewId | 'none'
  }
  /** All cabinets */
  allCabinets?: CabinetData[]
  /** Cabinet groups data */
  groups: {
    groupCabinets: GroupCabinet[]
    syncCabinets: string[]
    handleGroupChange: (group: GroupCabinet[]) => void
    handleSyncChange: (syncList: string[]) => void
  }
  /** View change callback */
  onViewChange?: (cabinetId: string, viewId: string) => void
}

/**
 * Icon for the Grouping section (layers/group icon)
 */
const GroupingIcon = () => (
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
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="9" y1="21" x2="9" y2="9" />
  </svg>
)

/**
 * GroupingSection - Merged View, Pair, and Sync sections into one collapsible card.
 * 
 * This component combines three related functionalities:
 * - View: Assign cabinet to a view
 * - Pair: Link cabinets with percentage distribution
 * - Sync: Sync dimension changes across cabinets
 */
export const GroupingSection: React.FC<GroupingSectionProps> = ({
  viewManager,
  selectedCabinet,
  allCabinets,
  groups,
  onViewChange,
}) => {
  const hasView = selectedCabinet.viewId && selectedCabinet.viewId !== 'none'

  // Get cabinets in view for pair/sync sections
  const cabinetsInView = hasView
    ? viewManager.getCabinetsInView(selectedCabinet.viewId as ViewId)
    : []

  return (
    <CollapsibleSection
      id="grouping"
      title="Grouping"
      icon={<GroupingIcon />}
    >
      <div className="space-y-4">
        {/* View Sub-section */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-gray-600">
            <Eye size={14} />
            <span className="text-xs font-medium uppercase tracking-wide">View</span>
          </div>
          <ViewSelector
            selectedViewId={selectedCabinet.viewId as ViewId | undefined}
            activeViews={viewManager.activeViews}
            onViewChange={(viewId) => {
              if (viewId === 'none') {
                viewManager.assignCabinetToView(selectedCabinet.cabinetId, 'none')
                onViewChange?.(selectedCabinet.cabinetId, 'none')
              } else {
                viewManager.assignCabinetToView(selectedCabinet.cabinetId, viewId)
                onViewChange?.(selectedCabinet.cabinetId, viewId)
              }
            }}
            onCreateView={() => {
              const newView = viewManager.createView()
              viewManager.assignCabinetToView(selectedCabinet.cabinetId, newView.id)
              onViewChange?.(selectedCabinet.cabinetId, newView.id)
            }}
            cabinetId={selectedCabinet.cabinetId}
            allCabinets={allCabinets}
            noWrapper
          />
        </div>

        {/* Pair Sub-section - only show when cabinet has a view */}
        {hasView && (
          <div className="pt-3 border-t border-gray-200">
            <div className="flex items-center gap-1.5 mb-2 text-gray-600">
              <Users size={14} />
              <span className="text-xs font-medium uppercase tracking-wide">Pair</span>
            </div>
            <PairSection
              selectedCabinet={{
                cabinetId: selectedCabinet.cabinetId,
                sortNumber: selectedCabinet.sortNumber,
              }}
              cabinetsInView={cabinetsInView}
              allCabinets={(allCabinets || []).map((c) => ({
                cabinetId: c.cabinetId,
                sortNumber: c.sortNumber,
              }))}
              groupCabinets={groups.groupCabinets}
              onGroupChange={groups.handleGroupChange}
              noWrapper
            />
          </div>
        )}

        {/* Sync Sub-section - only show when cabinet has a view */}
        {hasView && (
          <div className="pt-3 border-t border-gray-200">
            <div className="flex items-center gap-1.5 mb-2 text-gray-600">
              <RefreshCw size={14} />
              <span className="text-xs font-medium uppercase tracking-wide">Sync</span>
            </div>
            <SyncSection
              selectedCabinet={{
                cabinetId: selectedCabinet.cabinetId,
                sortNumber: selectedCabinet.sortNumber,
              }}
              cabinetsInView={cabinetsInView}
              allCabinets={(allCabinets || []).map((c) => ({
                cabinetId: c.cabinetId,
                sortNumber: c.sortNumber,
              }))}
              syncCabinets={groups.syncCabinets}
              onSyncChange={groups.handleSyncChange}
              noWrapper
            />
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}

export default GroupingSection
