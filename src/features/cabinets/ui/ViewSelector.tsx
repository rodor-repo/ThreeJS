import React from 'react'
import type { View, ViewId } from '../ViewManager'
import type { CabinetData } from '@/features/scene/types'

interface ViewSelectorProps {
  selectedViewId: ViewId | undefined
  activeViews: View[]
  onViewChange: (viewId: ViewId) => void
  onCreateView: () => void
  cabinetId?: string
  allCabinets?: CabinetData[]
}

export const ViewSelector: React.FC<ViewSelectorProps> = ({
  selectedViewId,
  activeViews,
  onViewChange,
  onCreateView,
  cabinetId,
  allCabinets = [],
}) => {
  const currentViewId = selectedViewId || 'none'

  const getActualCabinetCount = (view: View): number => {
    if (!allCabinets || allCabinets.length === 0) return 0
    return allCabinets.filter((cab) => cab.viewId === view.id && view.cabinetIds.has(cab.cabinetId)).length
  }

  const noneCount = allCabinets?.filter((cab) => !cab.viewId || cab.viewId === 'none').length || 0

  return (
    <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 mb-4">
      <div className="flex items-center space-x-2 mb-2.5 text-gray-700 font-medium">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <h3>View</h3>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={currentViewId}
          onChange={(e) => {
            const newViewId = e.target.value as ViewId
            onViewChange(newViewId)
          }}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="none">
            None ({noneCount} cabinet{noneCount !== 1 ? 's' : ''})
          </option>
          {activeViews.map((view) => {
            const actualCount = getActualCabinetCount(view)
            return (
              <option key={view.id} value={view.id}>
                {view.name} ({actualCount} cabinet{actualCount !== 1 ? 's' : ''})
              </option>
            )
          })}
        </select>
        <button
          onClick={onCreateView}
          className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          title="Create new view"
        >
          +
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Cabinets in the same view move together and maintain their relative positions.
      </p>
    </div>
  )
}
