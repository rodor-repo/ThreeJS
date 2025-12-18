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
  /** Whether this is a child benchtop (width/depth disabled, only thickness editable) */
  isChildBenchtop?: boolean
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
  /** Benchtop overhangs - only for child benchtops */
  benchtopOverhangs?: {
    front: number
    left: number
    right: number
  }
  /** Overhang change callback - only for child benchtops */
  onOverhangChange?: (type: 'front' | 'left' | 'right', value: number) => void
  /** Whether this is an independent benchtop (not a child) */
  isIndependentBenchtop?: boolean
  /** Height from floor for independent benchtops */
  benchtopHeightFromFloor?: number
  /** Height from floor change callback - only for independent benchtops */
  onHeightFromFloorChange?: (value: number) => void
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
  isChildBenchtop = false,
  onValueChange,
  onEditingChange,
  onReset,
  onResetAll,
  onValidate,
  noWrapper = false,
  benchtopOverhangs,
  onOverhangChange,
  isIndependentBenchtop = false,
  benchtopHeightFromFloor,
  onHeightFromFloorChange,
}) => {
  // Overhang editing state for child benchtops
  const [frontOverhangEdit, setFrontOverhangEdit] = React.useState('')
  const [leftOverhangEdit, setLeftOverhangEdit] = React.useState('')
  const [rightOverhangEdit, setRightOverhangEdit] = React.useState('')

  // Height from floor editing state for independent benchtops
  const [heightFromFloorEdit, setHeightFromFloorEdit] = React.useState('')

  // Sync edit values with actual values when they change externally
  React.useEffect(() => {
    if (benchtopOverhangs) {
      setFrontOverhangEdit(benchtopOverhangs.front.toString())
      setLeftOverhangEdit(benchtopOverhangs.left.toString())
      setRightOverhangEdit(benchtopOverhangs.right.toString())
    }
  }, [benchtopOverhangs?.front, benchtopOverhangs?.left, benchtopOverhangs?.right])

  // Sync height from floor edit value
  React.useEffect(() => {
    if (benchtopHeightFromFloor !== undefined) {
      setHeightFromFloorEdit(benchtopHeightFromFloor.toString())
    }
  }, [benchtopHeightFromFloor])

  // Height from floor slider change (immediate update)
  const handleHeightFromFloorSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value)
    if (!isNaN(value) && onHeightFromFloorChange) {
      const clampedValue = Math.max(0, Math.min(1200, value))
      setHeightFromFloorEdit(clampedValue.toString())
      onHeightFromFloorChange(clampedValue)
    }
  }

  // Height from floor number input change (update on blur)
  const handleHeightFromFloorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHeightFromFloorEdit(e.target.value)
  }

  const handleOverhangBlur = (type: 'front' | 'left' | 'right', editValue: string, originalValue: number) => {
    const numValue = parseFloat(editValue)
    if (!isNaN(numValue) && numValue >= 0 && onOverhangChange) {
      onOverhangChange(type, numValue)
    } else {
      // Reset to original value if invalid
      if (type === 'front') setFrontOverhangEdit(originalValue.toString())
      if (type === 'left') setLeftOverhangEdit(originalValue.toString())
      if (type === 'right') setRightOverhangEdit(originalValue.toString())
    }
  }

  const handleHeightFromFloorBlur = () => {
    const numValue = parseFloat(heightFromFloorEdit)
    const originalValue = benchtopHeightFromFloor ?? 740
    // Validate: min 0, max 1200
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 1200 && onHeightFromFloorChange) {
      onHeightFromFloorChange(numValue)
    } else {
      // Reset to original value if invalid
      setHeightFromFloorEdit(originalValue.toString())
    }
  }

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

          // Check if width/depth should be disabled for child benchtop
          // Child benchtops can only edit thickness (height in carcass terms)
          // Check by GDId first, then fallback to dimension name
          const dimName = (dimObj.dim || '').toLowerCase()
          const isWidthOrLengthByGD = dimObj.GDId && gdMapping.widthGDIds.includes(dimObj.GDId)
          const isWidthOrLengthByName = dimName.includes('length') || dimName.includes('width')
          const isWidthOrLengthDim = isWidthOrLengthByGD || isWidthOrLengthByName
          
          const isDepthByGD = dimObj.GDId && gdMapping.depthGDIds.includes(dimObj.GDId)
          const isDepthByName = dimName.includes('depth')
          const isDepthDim = isDepthByGD || isDepthByName
          
          const isDisabledForChildBenchtop = isChildBenchtop && (isWidthOrLengthDim || isDepthDim)

          const isDisabled = isDependentDrawer || !!isDisabledForFillerPanel || !!isDisabledForChildBenchtop

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

      {/* Overhang controls - Only for child benchtops */}
      {isChildBenchtop && benchtopOverhangs && onOverhangChange && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Overhangs</h4>
          <div className="space-y-1">
            {/* Front Overhang */}
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-gray-600">Front Overhang</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={frontOverhangEdit}
                  onChange={(e) => setFrontOverhangEdit(e.target.value)}
                  onBlur={() => handleOverhangBlur('front', frontOverhangEdit, benchtopOverhangs.front)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleOverhangBlur('front', frontOverhangEdit, benchtopOverhangs.front)
                    }
                  }}
                  className="w-20 px-2 py-1 text-sm text-right border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
                <span className="text-xs text-gray-400 w-8">mm</span>
              </div>
            </div>
            {/* Left Overhang */}
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-gray-600">Left Overhang</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={leftOverhangEdit}
                  onChange={(e) => setLeftOverhangEdit(e.target.value)}
                  onBlur={() => handleOverhangBlur('left', leftOverhangEdit, benchtopOverhangs.left)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleOverhangBlur('left', leftOverhangEdit, benchtopOverhangs.left)
                    }
                  }}
                  className="w-20 px-2 py-1 text-sm text-right border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
                <span className="text-xs text-gray-400 w-8">mm</span>
              </div>
            </div>
            {/* Right Overhang */}
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-gray-600">Right Overhang</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={rightOverhangEdit}
                  onChange={(e) => setRightOverhangEdit(e.target.value)}
                  onBlur={() => handleOverhangBlur('right', rightOverhangEdit, benchtopOverhangs.right)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleOverhangBlur('right', rightOverhangEdit, benchtopOverhangs.right)
                    }
                  }}
                  className="w-20 px-2 py-1 text-sm text-right border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
                <span className="text-xs text-gray-400 w-8">mm</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Height from Floor - Only for independent benchtops */}
      {isIndependentBenchtop && benchtopHeightFromFloor !== undefined && onHeightFromFloorChange && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Height (Underneath)
              </label>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-600">
                  Position
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <input
                  type="number"
                  className="w-20 text-center text-sm px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-tight"
                  value={heightFromFloorEdit}
                  min={0}
                  max={1200}
                  onChange={handleHeightFromFloorInputChange}
                  onBlur={handleHeightFromFloorBlur}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleHeightFromFloorBlur()
                    }
                  }}
                />
                <button
                  type="button"
                  title="Reset Height (Underneath) to default (740mm)"
                  onClick={() => {
                    setHeightFromFloorEdit('740')
                    onHeightFromFloorChange(740)
                  }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                >
                  <RotateCcw size={14} />
                </button>
                <span className="text-sm text-gray-500">mm</span>
              </div>
              <input
                type="range"
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                value={Number(heightFromFloorEdit) || 740}
                min={0}
                max={1200}
                onChange={handleHeightFromFloorSliderChange}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0</span>
                <span>1200</span>
              </div>
            </div>
          </div>
        </div>
      )}
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
