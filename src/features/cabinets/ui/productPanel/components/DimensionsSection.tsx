import React from 'react'
import { RotateCcw } from 'lucide-react'
import type { GDMapping } from '../hooks/useGDMapping'
import { getDimensionBadges, getDrawerHeightIndex } from '../hooks/useGDMapping'
import DimensionInput from './DimensionInput'
import type { DimEntry } from '../utils/dimensionUtils'

export interface DimensionsSectionProps {
  /** Sorted list of dimension entries */
  dimsList: DimEntry[]
  /** Current dimension values */
  values: Record<string, number | string>
  /** Editing buffer values */
  editingValues: Record<string, string>
  /** GD mapping for badges and type detection */
  gdMapping: GDMapping
  /** Drawer quantity for dependent drawer detection */
  drawerQty: number
  /** Whether this is a modal filler/panel (height/depth disabled) */
  isModalFillerOrPanel: boolean
  /** Value change callback */
  onValueChange: (id: string, value: number | string) => void
  /** Editing value change callback */
  onEditingChange: (id: string, value: string | undefined) => void
  /** Reset single dimension callback */
  onReset: (id: string) => void
  /** Reset all dimensions callback */
  onResetAll: () => void
  /** Optional validation function */
  onValidate?: (id: string, value: number) => string | undefined
  /** If true, renders only inner content without card wrapper */
  noWrapper?: boolean
}

/**
 * Dimensions section component with all dimension controls
 */
export const DimensionsSection: React.FC<DimensionsSectionProps> = ({
  dimsList,
  values,
  editingValues,
  gdMapping,
  drawerQty,
  isModalFillerOrPanel,
  onValueChange,
  onEditingChange,
  onReset,
  onResetAll,
  onValidate,
  noWrapper = false,
}) => {
  const content = (
    <div className="space-y-3">
      {dimsList
        .filter(([, dimObj]) => dimObj.visible !== false)
        .map(([id, dimObj]) => {
          // Get drawer height index if applicable
          const drawerHeightIndex = getDrawerHeightIndex(dimObj.GDId, gdMapping)

          // Check if this is the dependent (last) drawer
          const isDependentDrawer = drawerHeightIndex !== null &&
            drawerHeightIndex === (drawerQty - 1)

          // Check if height/depth should be disabled for modal filler/panel
          const isDisabledForFillerPanel = isModalFillerOrPanel && dimObj.GDId && (
            gdMapping.heightGDIds.includes(dimObj.GDId) ||
            gdMapping.depthGDIds.includes(dimObj.GDId)
          )

          const isDisabled = isDependentDrawer || !!isDisabledForFillerPanel

          // Get badges for this dimension
          const badges = getDimensionBadges(dimObj.GDId, gdMapping)

          return (
            <DimensionInput
              key={id}
              id={id}
              dimObj={dimObj}
              value={values[id]}
              editingValue={editingValues[id]}
              disabled={isDisabled}
              badges={badges}
              onValueChange={onValueChange}
              onEditingChange={onEditingChange}
              onReset={onReset}
              onValidate={onValidate}
            />
          )
        })}
    </div>
  )

  if (noWrapper) {
    return (
      <>
        <div className="flex items-center justify-between mb-2.5">
          <button
            type="button"
            title="Reset all dimensions"
            onClick={onResetAll}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors px-2 py-1 rounded-md hover:bg-blue-50 ml-auto"
          >
            <RotateCcw size={14} />
            Reset
          </button>
        </div>
        {content}
      </>
    )
  }

  return (
    <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-2.5 text-gray-700 font-medium">
        <div className="flex items-center space-x-2">
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
            <path d="M16 3h5v5" />
            <path d="M8 21H3v-5" />
            <path d="M21 3l-7 7" />
            <path d="M3 21l7-7" />
          </svg>
          <h3>Dimensions</h3>
        </div>
        <button
          type="button"
          title="Reset all dimensions"
          onClick={onResetAll}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors px-2 py-1 rounded-md hover:bg-blue-50"
        >
          <RotateCcw size={14} />
          Reset
        </button>
      </div>
      {content}
    </div>
  )
}

export default DimensionsSection
