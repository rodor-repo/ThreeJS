'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { CabinetData } from '@/features/scene/types'

// Appliance type labels and icons
const APPLIANCE_INFO: Record<string, { label: string; icon: string }> = {
  dishwasher: { label: 'Dishwasher', icon: '🍽️' },
  washingMachine: { label: 'Washing Machine', icon: '🧺' },
  sideBySideFridge: { label: 'Side-by-Side Fridge', icon: '🧊' },
}

interface AppliancePanelProps {
  isVisible: boolean
  selectedCabinet: CabinetData | null
  onClose: () => void
  viewManager: {
    activeViews: Array<{ id: string; name: string }>
  }
  onViewChange: (cabinetId: string, viewId: string) => void
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
}) => {
  // Local state for dimensions and gaps
  const [width, setWidth] = useState(600)
  const [height, setHeight] = useState(820)
  const [depth, setDepth] = useState(600)
  const [topGap, setTopGap] = useState(0)
  const [leftGap, setLeftGap] = useState(0)
  const [rightGap, setRightGap] = useState(0)

  // Get appliance type from config
  const applianceType = selectedCabinet?.carcass?.config?.applianceType || 'dishwasher'
  const applianceInfo = APPLIANCE_INFO[applianceType] || APPLIANCE_INFO.dishwasher

  // Initialize from selected cabinet
  useEffect(() => {
    if (selectedCabinet?.carcass) {
      const dims = selectedCabinet.carcass.dimensions
      const config = selectedCabinet.carcass.config
      setWidth(dims.width)
      setHeight(dims.height)
      setDepth(dims.depth)
      setTopGap(config.applianceTopGap || 0)
      setLeftGap(config.applianceLeftGap || 0)
      setRightGap(config.applianceRightGap || 0)
    }
  }, [selectedCabinet])

  // Update dimensions when changed
  const handleDimensionChange = useCallback((dimension: 'width' | 'height' | 'depth', value: number) => {
    if (!selectedCabinet?.carcass) return

    const newDims = {
      width: dimension === 'width' ? value : width,
      height: dimension === 'height' ? value : height,
      depth: dimension === 'depth' ? value : depth,
    }

    selectedCabinet.carcass.updateDimensions(newDims)

    if (dimension === 'width') setWidth(value)
    if (dimension === 'height') setHeight(value)
    if (dimension === 'depth') setDepth(value)
  }, [selectedCabinet, width, height, depth])

  // Update gaps when changed
  const handleGapChange = useCallback((gap: 'top' | 'left' | 'right', value: number) => {
    if (!selectedCabinet?.carcass) return

    const newConfig = {
      applianceTopGap: gap === 'top' ? value : topGap,
      applianceLeftGap: gap === 'left' ? value : leftGap,
      applianceRightGap: gap === 'right' ? value : rightGap,
    }

    // Update config and rebuild
    selectedCabinet.carcass.updateConfig(newConfig)

    if (gap === 'top') setTopGap(value)
    if (gap === 'left') setLeftGap(value)
    if (gap === 'right') setRightGap(value)
  }, [selectedCabinet, topGap, leftGap, rightGap])

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
        {/* Dimensions Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Dimensions</h3>

          <SliderInput
            label="Width"
            value={width}
            min={300}
            max={1200}
            step={10}
            onChange={(v) => handleDimensionChange('width', v)}
          />

          <SliderInput
            label="Height"
            value={height}
            min={600}
            max={2400}
            step={10}
            onChange={(v) => handleDimensionChange('height', v)}
          />

          <SliderInput
            label="Depth"
            value={depth}
            min={400}
            max={800}
            step={10}
            onChange={(v) => handleDimensionChange('depth', v)}
          />
        </div>

        {/* Gaps Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Gaps</h3>
          <p className="text-xs text-gray-500">Spacing between appliance and cabinet shell</p>

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
        </div>

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
