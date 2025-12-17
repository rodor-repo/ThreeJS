'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { CabinetData, WallDimensions } from '@/features/scene/types'
import { ViewId } from '@/features/cabinets/ViewManager'
import { repositionViewCabinets, checkLeftWallOverflow } from '@/features/scene/utils/handlers/viewRepositionHandler'
import { applyWidthChangeWithLock } from '@/features/scene/utils/handlers/lockBehaviorHandler'
import { toastThrottled } from './ProductPanel'

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
  onClose: () => void
  viewManager: {
    activeViews: Array<{ id: string; name: string }>
    getCabinetsInView: (viewId: ViewId) => string[]
  }
  onViewChange: (cabinetId: string, viewId: string) => void
  // New props for view integration
  cabinets: CabinetData[]
  cabinetGroups: Map<string, Array<{ cabinetId: string; percentage: number }>>
  wallDimensions: WallDimensions
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
            type="text"
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

export const AppliancePanel: React.FC<AppliancePanelProps> = ({
  isVisible,
  selectedCabinet,
  onClose,
  viewManager,
  onViewChange,
  cabinets,
  cabinetGroups,
  wallDimensions,
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

      // Calculate visual dimensions from shell - gaps
      setVisualWidth(shellDims.width - lGap - rGap)
      setVisualHeight(shellDims.height - tGap)
      setVisualDepth(shellDims.depth)
      setTopGap(tGap)
      setLeftGap(lGap)
      setRightGap(rGap)
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

  // Helper to trigger view cabinet repositioning
  const triggerViewReposition = useCallback((
    widthDelta: number,
    oldX: number,
    oldWidth: number
  ) => {
    if (!selectedCabinet || !selectedCabinet.viewId || selectedCabinet.viewId === 'none') {
      return
    }

    repositionViewCabinets(
      selectedCabinet,
      widthDelta,
      oldX,
      oldWidth,
      cabinets,
      cabinetGroups,
      viewManager as ViewManagerResult,
      wallDimensions
    )
  }, [selectedCabinet, cabinets, cabinetGroups, viewManager, wallDimensions])

  // Update VISUAL dimensions when changed
  // This changes the appliance size, which also changes the shell size (visual + gaps)
  const handleDimensionChange = useCallback((dimension: 'width' | 'height' | 'depth', value: number) => {
    if (!selectedCabinet?.carcass) return

    // Store old shell dimensions and position for view repositioning
    const oldShellWidth = selectedCabinet.carcass.dimensions.width
    const oldX = selectedCabinet.group.position.x

    // Calculate new shell dimensions (visual + gaps)
    const newShellWidth = dimension === 'width' ? value + leftGap + rightGap : visualWidth + leftGap + rightGap
    const newShellHeight = dimension === 'height' ? value + topGap : visualHeight + topGap
    const newShellDepth = dimension === 'depth' ? value : visualDepth

    const newShellDims = {
      width: newShellWidth,
      height: newShellHeight,
      depth: newShellDepth,
    }

    // Apply lock behavior if width changed
    if (dimension === 'width' && newShellWidth !== oldShellWidth) {
      if (selectedCabinet.viewId && selectedCabinet.viewId !== 'none') {
        const leftLock = selectedCabinet.leftLock ?? false
        const rightLock = selectedCabinet.rightLock ?? false
        const widthDelta = newShellWidth - oldShellWidth

        // Check for left wall overflow
        if (widthDelta > 0) {
          const pushAmount = rightLock ? widthDelta : (!leftLock && !rightLock) ? widthDelta / 2 : 0
          
          if (pushAmount > 0) {
            // Check if THIS cabinet hits the wall
            if (oldX - pushAmount < -0.1) {
              toastThrottled('Cannot expand: cabinet would hit the left wall')
              return
            }

            const rightEdge = oldX + oldShellWidth
            const overflow = checkLeftWallOverflow(
              pushAmount,
              selectedCabinet.cabinetId,
              rightEdge,
              selectedCabinet.viewId as ViewId,
              cabinets,
              cabinetGroups,
              viewManager as ViewManagerResult
            )

            if (overflow !== null) {
              toastThrottled(
                `Cannot expand width: a cabinet would be pushed ${overflow.toFixed(
                  0
                )}mm past the left wall. Please reduce the width or move cabinets first.`
              )
              return
            }
          }
        }
      }

      const lockResult = applyWidthChangeWithLock(
        selectedCabinet,
        newShellWidth,
        oldShellWidth,
        oldX
      )

      if (!lockResult) {
        toastThrottled('Cannot resize width when both left and right edges are locked')
        return
      }

      const { newX } = lockResult
      selectedCabinet.group.position.x = newX
    }

    // Update carcass dimensions (this is the shell)
    selectedCabinet.carcass.updateDimensions(newShellDims)

    // Update local visual state
    if (dimension === 'width') setVisualWidth(value)
    if (dimension === 'height') setVisualHeight(value)
    if (dimension === 'depth') setVisualDepth(value)

    // Trigger view repositioning if width changed and cabinet is in a view
    if (dimension === 'width') {
      const widthDelta = newShellWidth - oldShellWidth
      if (Math.abs(widthDelta) > 0.1) {
        triggerViewReposition(widthDelta, oldX, oldShellWidth)
      }
    }
  }, [selectedCabinet, visualWidth, visualHeight, visualDepth, topGap, leftGap, rightGap, triggerViewReposition])

  // Update gaps when changed
  // This changes the shell size while keeping visual size the same
  const handleGapChange = useCallback((gap: 'top' | 'left' | 'right', value: number) => {
    if (!selectedCabinet?.carcass) return

    // Store old shell dimensions and position for view repositioning
    const oldShellWidth = selectedCabinet.carcass.dimensions.width
    const oldX = selectedCabinet.group.position.x

    // Calculate new gaps
    const newTopGap = gap === 'top' ? value : topGap
    const newLeftGap = gap === 'left' ? value : leftGap
    const newRightGap = gap === 'right' ? value : rightGap

    // Calculate new shell dimensions (visual dimensions stay the same!)
    const newShellWidth = visualWidth + newLeftGap + newRightGap
    const newShellHeight = visualHeight + newTopGap
    const newShellDepth = visualDepth

    const newShellDims = {
      width: newShellWidth,
      height: newShellHeight,
      depth: newShellDepth,
    }

    // Apply lock behavior if shell width changed
    const widthDelta = newShellWidth - oldShellWidth
    if (Math.abs(widthDelta) > 0.1) {
      if (selectedCabinet.viewId && selectedCabinet.viewId !== 'none') {
        const leftLock = selectedCabinet.leftLock ?? false
        const rightLock = selectedCabinet.rightLock ?? false

        // Check for left wall overflow
        if (widthDelta > 0) {
          const pushAmount = rightLock ? widthDelta : (!leftLock && !rightLock) ? widthDelta / 2 : 0
          
          if (pushAmount > 0) {
            // Check if THIS cabinet hits the wall
            if (oldX - pushAmount < -0.1) {
              toastThrottled('Cannot expand: cabinet would hit the left wall')
              return
            }

            const rightEdge = oldX + oldShellWidth
            const overflow = checkLeftWallOverflow(
              pushAmount,
              selectedCabinet.cabinetId,
              rightEdge,
              selectedCabinet.viewId as ViewId,
              cabinets,
              cabinetGroups,
              viewManager as ViewManagerResult
            )

            if (overflow !== null) {
              toastThrottled(
                `Cannot expand gaps: a cabinet would be pushed ${overflow.toFixed(
                  0
                )}mm past the left wall. Please reduce the gaps or move cabinets first.`
              )
              return
            }
          }
        }
      }

      const lockResult = applyWidthChangeWithLock(
        selectedCabinet,
        newShellWidth,
        oldShellWidth,
        oldX
      )

      if (!lockResult) {
        toastThrottled('Cannot resize gaps when both left and right edges are locked')
        return
      }

      const { newX } = lockResult
      selectedCabinet.group.position.x = newX
    }

    // Update config with new gap values
    const newConfig = {
      applianceTopGap: newTopGap,
      applianceLeftGap: newLeftGap,
      applianceRightGap: newRightGap,
    }

    // Update carcass dimensions first (the shell)
    selectedCabinet.carcass.updateDimensions(newShellDims)

    // Update config (this also rebuilds, but dimensions are already set)
    selectedCabinet.carcass.updateConfig(newConfig)

    // Update local gap state
    if (gap === 'top') setTopGap(value)
    if (gap === 'left') setLeftGap(value)
    if (gap === 'right') setRightGap(value)

    // Trigger view repositioning if shell width changed
    if (Math.abs(widthDelta) > 0.1) {
      triggerViewReposition(widthDelta, oldX, oldShellWidth)
    }
  }, [selectedCabinet, visualWidth, visualHeight, visualDepth, topGap, leftGap, rightGap, triggerViewReposition])

  // Calculate displayed shell dimensions for info display
  const shellWidth = useMemo(() => visualWidth + leftGap + rightGap, [visualWidth, leftGap, rightGap])
  const shellHeight = useMemo(() => visualHeight + topGap, [visualHeight, topGap])

  if (!isVisible || !selectedCabinet) return null

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed right-0 top-0 h-full w-96 max-w-[90vw] bg-white shadow-2xl z-40 flex flex-col productPanel"
      data-product-panel
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white">
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Appliance Dimensions Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Appliance Size</h3>
          <p className="text-xs text-gray-500">Size of the appliance itself</p>

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

        {/* Gaps Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Gaps</h3>
          <p className="text-xs text-gray-500">Extra space around appliance (expands cabinet opening)</p>

          <SliderInput
            label="Top Gap"
            value={topGap}
            min={0}
            max={100}
            step={1}
            onChange={(v) => handleGapChange('top', v)}
          />

          <SliderInput
            label="Left Gap"
            value={leftGap}
            min={0}
            max={50}
            step={1}
            onChange={(v) => handleGapChange('left', v)}
          />

          <SliderInput
            label="Right Gap"
            value={rightGap}
            min={0}
            max={50}
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

        {/* Fridge Configuration */}
        {applianceType === 'sideBySideFridge' && selectedCabinet?.carcass?.config && (
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Fridge Options</h3>

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
          </div>
        )}

        {/* View Assignment */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">View Assignment</h3>
          <select
            value={selectedCabinet.viewId || 'none'}
            onChange={(e) => onViewChange(selectedCabinet.cabinetId, e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="none">No View</option>
            {viewManager.activeViews.map((view) => (
              <option key={view.id} value={view.id}>
                {view.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <p className="text-xs text-gray-500 text-center">
          Appliances are not included in nesting exports
        </p>
      </div>
    </motion.div>
  )
}

export default AppliancePanel
