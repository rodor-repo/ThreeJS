'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Maximize, Move, Settings } from 'lucide-react'
import type { CabinetData, WallDimensions } from '@/features/scene/types'
import { View, ViewId } from '@/features/cabinets/ViewManager'
import { updateAllDependentComponents } from '@/features/scene/utils/handlers/dependentComponentsHandler'
import { applyApplianceGapChange } from '@/features/scene/utils/handlers/applianceGapHandler'
import { handleApplianceHorizontalGapChange, handleApplianceWidthChange } from '@/features/scene/utils/handlers/applianceDimensionHandler'
import { APPLIANCE_GAP_LIMITS } from '@/features/cabinets/factory/cabinetFactory'
import { CollapsibleSection } from './productPanel/components/CollapsibleSection'
import { GroupingSection } from './productPanel/components/GroupingSection'
import { FormulaSection } from './productPanel/components/FormulaSection'
import { useCabinetGroups } from './productPanel/hooks/useCabinetGroups'
import type { FormulaPiece } from '@/types/formulaTypes'
import { APPLIANCE_FORMULA_DIMENSIONS } from '@/types/formulaTypes'

// Appliance type labels and icons
const APPLIANCE_INFO: Record<string, { label: string; icon: string }> = {
  dishwasher: { label: 'Dishwasher', icon: '🍽️' },
  washingMachine: { label: 'Washing Machine', icon: '🧺' },
  sideBySideFridge: { label: 'Side-by-Side Fridge', icon: '🧊' },
}

interface ViewManagerResult {
  getCabinetsInView: (viewId: ViewId) => string[]
}

interface AppliancePanelProps {
  isVisible: boolean
  selectedCabinet: CabinetData | null
  selectedCabinets: CabinetData[]
  onClose: () => void
  viewManager: {
    activeViews: View[]
    getCabinetsInView: (viewId: ViewId) => string[]
    assignCabinetToView: (cabinetId: string, viewId: ViewId | 'none') => void
    createView: () => View
  }
  onViewChange: (cabinetId: string, viewId: string) => void
  onGroupChange?: (cabinetId: string, groupCabinets: Array<{ cabinetId: string; percentage: number }>) => void
  onSyncChange?: (cabinetId: string, syncCabinets: string[]) => void
  // New props for view integration
  cabinets: CabinetData[]
  cabinetGroups: Map<string, Array<{ cabinetId: string; percentage: number }>>
  cabinetSyncs: Map<string, string[]>
  wallDimensions: WallDimensions
  formulaPieces?: FormulaPiece[]
  getFormula?: (cabinetId: string, dimId: string) => string | undefined
  onFormulaChange?: (
    cabinetId: string,
    dimId: string,
    formula: string | null
  ) => void
  getFormulaLastEvaluatedAt?: (cabinetId: string) => number | undefined
  onDimensionsUpdated?: () => void
}

interface SliderInputProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
}

const SliderInput: React.FC<SliderInputProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = 'mm',
  onChange,
}) => {
  const [editingValue, setEditingValue] = useState<string>(String(value))

  useEffect(() => {
    setEditingValue(String(value))
  }, [value])

  const handleBlur = () => {
    const numValue = parseFloat(editingValue)
    if (!isNaN(numValue)) {
      const clamped = Math.max(min, Math.min(max, numValue))
      onChange(clamped)
      setEditingValue(String(clamped))
    } else {
      setEditingValue(String(value))
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
            className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-right"
          />
          <span className="text-xs text-gray-500">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  )
}

// Icons for collapsible sections
const SizeIcon = () => (
  <Maximize size={20} />
)

const GapsIcon = () => (
  <Move size={20} />
)

const FridgeIcon = () => (
  <Settings size={20} />
)

export const AppliancePanel: React.FC<AppliancePanelProps> = ({
  isVisible,
  selectedCabinet,
  selectedCabinets,
  onClose,
  viewManager,
  onViewChange,
  onGroupChange,
  onSyncChange,
  cabinets,
  cabinetGroups,
  cabinetSyncs,
  wallDimensions,
  formulaPieces,
  getFormula,
  onFormulaChange,
  getFormulaLastEvaluatedAt,
  onDimensionsUpdated,
}) => {
  // Local state for VISUAL dimensions and gaps
  // Visual dimensions = what the user sees as the appliance size
  // Shell dimensions (stored in carcass.dimensions) = visual + gaps
  const [visualWidth, setVisualWidth] = useState(600)
  const [visualHeight, setVisualHeight] = useState(820)
  const [visualDepth, setVisualDepth] = useState(600)
  const [topGap, setTopGap] = useState(0)
  const [leftGap, setLeftGap] = useState(0)
  const [rightGap, setRightGap] = useState(0)
  const [kickerHeight, setKickerHeight] = useState(100)

  // Panel expand/collapse state (matching ProductPanel)
  const [isExpanded, setIsExpanded] = useState(true)

  // Get appliance type from config
  const applianceType = selectedCabinet?.carcass?.config?.applianceType || 'dishwasher'
  const applianceInfo = APPLIANCE_INFO[applianceType] || APPLIANCE_INFO.dishwasher

  // Initialize from selected cabinet
  // Shell dimensions are stored in carcass.dimensions
  // Visual dimensions = shell - gaps
  useEffect(() => {
    if (selectedCabinet?.carcass) {
      const shellDims = selectedCabinet.carcass.dimensions
      const config = selectedCabinet.carcass.config
      const tGap = config.applianceTopGap || 0
      const lGap = config.applianceLeftGap || 0
      const rGap = config.applianceRightGap || 0
      const kHeight = config.applianceKickerHeight || 100

      // Calculate visual dimensions from shell - gaps - kicker
      setVisualWidth(shellDims.width - lGap - rGap)
      setVisualHeight(shellDims.height - tGap - kHeight)
      setVisualDepth(shellDims.depth)
      setTopGap(tGap)
      setLeftGap(lGap)
      setRightGap(rGap)
      setKickerHeight(kHeight)
    }
  }, [selectedCabinet])

  // Force update for deep config changes
  const [, forceUpdate] = useState({})

  const handleFridgeConfigChange = useCallback((key: 'doorCount' | 'doorSide', value: any) => {
    if (!selectedCabinet?.carcass) return

    const newConfig = {
      [key === 'doorCount' ? 'fridgeDoorCount' : 'fridgeDoorSide']: value
    }

    selectedCabinet.carcass.updateConfig(newConfig)
    forceUpdate({})
  }, [selectedCabinet])

  const selectedCabinetId = selectedCabinet?.cabinetId
  const initialGroupData = useMemo(
    () => (selectedCabinetId ? cabinetGroups.get(selectedCabinetId) || [] : []),
    [cabinetGroups, selectedCabinetId]
  )

  const initialSyncData = useMemo(
    () => (selectedCabinetId ? cabinetSyncs.get(selectedCabinetId) || [] : []),
    [cabinetSyncs, selectedCabinetId]
  )

  const groups = useCabinetGroups({
    cabinetId: selectedCabinetId,
    initialGroupData,
    initialSyncData,
    onGroupChange,
    onSyncChange,
  })

  const applianceFormulaDimensions = useMemo(
    () =>
      APPLIANCE_FORMULA_DIMENSIONS.map((dim) => ({
        id: dim.id,
        label: dim.label,
      })),
    []
  )
  const lastFormulaEvaluatedAt = selectedCabinetId && getFormulaLastEvaluatedAt
    ? getFormulaLastEvaluatedAt(selectedCabinetId)
    : undefined

  // Update VISUAL dimensions when changed
  // This changes the appliance size, which also changes the shell size (visual + gaps)
  const handleDimensionChange = useCallback((dimension: 'width' | 'height' | 'depth', value: number) => {
    if (!selectedCabinet?.carcass) return

    if (dimension === 'width') {
      const applied = handleApplianceWidthChange(value, {
        selectedCabinet,
        selectedCabinets,
        cabinets,
        cabinetSyncs,
        cabinetGroups,
        viewManager: viewManager as ViewManagerResult,
        wallDimensions,
      })

      if (applied) {
        setVisualWidth(value)
        onDimensionsUpdated?.()
      }
      return
    }

    const newShellWidth = visualWidth + leftGap + rightGap
    const newShellHeight = dimension === 'height' ? value + topGap + kickerHeight : visualHeight + topGap + kickerHeight
    const newShellDepth = dimension === 'depth' ? value : visualDepth

    selectedCabinet.carcass.updateDimensions({
      width: newShellWidth,
      height: newShellHeight,
      depth: newShellDepth,
    })

    updateAllDependentComponents(selectedCabinet, cabinets, wallDimensions, {
      widthChanged: false,
      heightChanged: dimension === 'height',
      depthChanged: dimension === 'depth',
    })

    if (dimension === 'height') setVisualHeight(value)
    if (dimension === 'depth') setVisualDepth(value)
    onDimensionsUpdated?.()
  }, [selectedCabinet, selectedCabinets, visualWidth, visualHeight, visualDepth, topGap, leftGap, rightGap, kickerHeight, cabinets, cabinetGroups, cabinetSyncs, viewManager, wallDimensions, onDimensionsUpdated])

  // Update gaps when changed
  // This changes the shell size while keeping visual size the same
  const handleGapChange = useCallback((gap: 'top' | 'left' | 'right', value: number) => {
    if (!selectedCabinet?.carcass) return

    if (gap === 'left' || gap === 'right') {
      const result = handleApplianceHorizontalGapChange(
        { [gap]: value },
        {
          selectedCabinet,
          selectedCabinets,
          cabinets,
          cabinetSyncs,
          cabinetGroups,
          viewManager: viewManager as ViewManagerResult,
          wallDimensions,
        }
      )

      if (!result.applied) return

      setLeftGap(result.newGaps.left)
      setRightGap(result.newGaps.right)
      onDimensionsUpdated?.()
      return
    }

    const result = applyApplianceGapChange({
      cabinet: selectedCabinet,
      gaps: {
        top: value,
      },
      cabinets,
      cabinetGroups,
      viewManager: viewManager as ViewManagerResult,
      wallDimensions,
    })

    if (!result.applied) return

    setTopGap(result.newGaps.top)
    onDimensionsUpdated?.()
  }, [selectedCabinet, selectedCabinets, cabinets, cabinetGroups, cabinetSyncs, viewManager, wallDimensions, onDimensionsUpdated])

  // Update kicker height - this also changes shell height
  const handleKickerChange = useCallback((value: number) => {
    if (!selectedCabinet?.carcass) return

    // Calculate new shell height (visual + topGap + new kicker)
    const newShellHeight = visualHeight + topGap + value
    const newShellDims = {
      width: selectedCabinet.carcass.dimensions.width,
      height: newShellHeight,
      depth: selectedCabinet.carcass.dimensions.depth,
    }

    // Update shell dimensions
    selectedCabinet.carcass.updateDimensions(newShellDims)

    // Update config with new kicker height
    selectedCabinet.carcass.updateConfig({
      applianceKickerHeight: value,
    })

    // Update all dependent components (benchtop, kicker, etc.)
    updateAllDependentComponents(selectedCabinet, cabinets, wallDimensions, {
      heightChanged: true,
      kickerHeightChanged: true,
    })

    setKickerHeight(value)
    onDimensionsUpdated?.()
  }, [selectedCabinet, visualHeight, topGap, onDimensionsUpdated])

  // Calculate displayed shell dimensions for info display
  const shellWidth = useMemo(() => visualWidth + leftGap + rightGap, [visualWidth, leftGap, rightGap])
  const shellHeight = useMemo(() => visualHeight + topGap + kickerHeight, [visualHeight, topGap, kickerHeight])

  if (!isVisible || !selectedCabinet) return null

  return (
    <div
      className="fixed right-0 top-0 h-full bg-white shadow-lg border-l border-gray-200 transition-all duration-300 ease-in-out z-50 productPanel"
      data-product-panel
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Expand/Collapse button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          setIsExpanded(!isExpanded)
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        className="absolute -left-3 top-1/2 transform -translate-y-1/2 bg-blue-600 text-white rounded-full p-1 hover:bg-blue-700 transition-colors"
      >
        {isExpanded ? '<' : '>'}
      </button>

      <div
        className={`h-full transition-all duration-300 ease-in-out ${isExpanded ? 'w-80 sm:w-96 max-w-[90vw]' : 'w-0'
          } overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100`}
      >
        {/* Header - matching ProductPanel style */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-white border-b border-gray-200 px-4 py-3 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{applianceInfo.icon}</span>
              <div>
                <h2 className="text-lg font-bold text-gray-800">{applianceInfo.label}</h2>
                <p className="text-sm text-gray-500">#{selectedCabinet.sortNumber}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content with collapsible sections */}
        <div className="p-4 space-y-4">
          {/* View Assignment Section */}
          <GroupingSection
            viewManager={viewManager}
            selectedCabinet={{
              cabinetId: selectedCabinet.cabinetId,
              sortNumber: selectedCabinet.sortNumber,
              viewId: selectedCabinet.viewId as ViewId,
            }}
            allCabinets={cabinets}
            groups={groups}
            onViewChange={onViewChange}
          />

          {/* Appliance Size Section */}
          <CollapsibleSection
            id="applianceSize"
            title="Appliance Size"
            icon={<SizeIcon />}
          >
            <div className="space-y-4">
              <p className="text-xs text-gray-500 mb-3">Size of the appliance itself</p>
              <SliderInput
                label="Width"
                value={visualWidth}
                min={300}
                max={1200}
                step={10}
                onChange={(v) => handleDimensionChange('width', v)}
              />
              <SliderInput
                label="Height"
                value={visualHeight}
                min={600}
                max={2400}
                step={10}
                onChange={(v) => handleDimensionChange('height', v)}
              />
              <SliderInput
                label="Depth"
                value={visualDepth}
                min={400}
                max={800}
                step={10}
                onChange={(v) => handleDimensionChange('depth', v)}
              />
            </div>
          </CollapsibleSection>

          {/* Gaps Section */}
          <CollapsibleSection
            id="applianceGaps"
            title="Gaps"
            icon={<GapsIcon />}
          >
            <div className="space-y-4">
              <p className="text-xs text-gray-500 mb-3">Extra space around appliance (expands cabinet opening)</p>
              <SliderInput
                label="Top Gap"
                value={topGap}
                min={APPLIANCE_GAP_LIMITS.top.min}
                max={APPLIANCE_GAP_LIMITS.top.max}
                step={1}
                onChange={(v) => handleGapChange('top', v)}
              />
              <SliderInput
                label="Left Gap"
                value={leftGap}
                min={APPLIANCE_GAP_LIMITS.side.min}
                max={APPLIANCE_GAP_LIMITS.side.max}
                step={1}
                onChange={(v) => handleGapChange('left', v)}
              />
              <SliderInput
                label="Right Gap"
                value={rightGap}
                min={APPLIANCE_GAP_LIMITS.side.min}
                max={APPLIANCE_GAP_LIMITS.side.max}
                step={1}
                onChange={(v) => handleGapChange('right', v)}
              />
              {/* Shell dimensions info */}
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-700 font-medium">Cabinet Opening (Shell)</p>
                <p className="text-xs text-blue-600">
                  {shellWidth}mm × {shellHeight}mm × {visualDepth}mm
                </p>
              </div>
            </div>
          </CollapsibleSection>

          {selectedCabinet && formulaPieces && onFormulaChange && (
            <CollapsibleSection
              id="applianceFormulas"
              title="Formulas"
              icon={<FridgeIcon />}
            >
              <FormulaSection
                cabinetId={selectedCabinet.cabinetId}
                dimensions={applianceFormulaDimensions}
                pieces={formulaPieces}
                getFormula={getFormula}
                onFormulaChange={onFormulaChange}
                lastEvaluatedAt={lastFormulaEvaluatedAt}
              />
            </CollapsibleSection>
          )}

          {/* Kicker Section */}
          <CollapsibleSection
            id="applianceKicker"
            title="Kicker"
            icon={<SizeIcon />}
          >
            <div className="space-y-4">
              <p className="text-xs text-gray-500 mb-3">Height of kick panels at the base of the appliance</p>
              <SliderInput
                label="Kicker Height"
                value={kickerHeight}
                min={16}
                max={170}
                step={1}
                onChange={handleKickerChange}
              />
            </div>
          </CollapsibleSection>

          {/* Fridge Configuration - only for sideBySideFridge */}
          {applianceType === 'sideBySideFridge' && selectedCabinet?.carcass?.config && (
            <CollapsibleSection
              id="applianceFridge"
              title="Fridge Options"
              icon={<FridgeIcon />}
            >
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5">Door Configuration</label>
                  <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                      onClick={() => handleFridgeConfigChange('doorCount', 1)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${selectedCabinet.carcass.config.fridgeDoorCount === 1
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                      1 Door
                    </button>
                    <button
                      onClick={() => handleFridgeConfigChange('doorCount', 2)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${(selectedCabinet.carcass.config.fridgeDoorCount !== 1) // Default 2
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                      2 Doors
                    </button>
                  </div>
                </div>

                {selectedCabinet.carcass.config.fridgeDoorCount === 1 && (
                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">Handle Position</label>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                      <button
                        onClick={() => handleFridgeConfigChange('doorSide', 'left')}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${(selectedCabinet.carcass.config.fridgeDoorSide !== 'right') // Default left
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                          }`}
                      >
                        Left
                      </button>
                      <button
                        onClick={() => handleFridgeConfigChange('doorSide', 'right')}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${selectedCabinet.carcass.config.fridgeDoorSide === 'right'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                          }`}
                      >
                        Right
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            Appliances are not included in nesting exports
          </p>
        </div>
      </div>
    </div>
  )
}

export default AppliancePanel
