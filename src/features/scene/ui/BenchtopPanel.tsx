'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { CabinetData } from '../types'
import { updateBenchtopPosition } from '../utils/handlers/benchtopPositionHandler'
import { getEffectiveBenchtopDimensions } from '../utils/handlers/benchtopHandler'

interface BenchtopPanelProps {
  isVisible: boolean
  selectedCabinet: CabinetData | null
  allCabinets: CabinetData[]
  onClose: () => void
  onCabinetUpdate?: (cabinetId: string, updates: Partial<CabinetData>) => void
}

interface SliderInputProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  disabled?: boolean
  onChange: (value: number) => void
}

const SliderInput: React.FC<SliderInputProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = 'mm',
  disabled = false,
  onChange,
}) => {
  const [editingValue, setEditingValue] = useState<string>(String(value))

  useEffect(() => {
    setEditingValue(String(value))
  }, [value])

  const handleBlur = () => {
    if (disabled) return
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
    <div className={`space-y-2 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={editingValue}
            disabled={disabled}
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
            className={`w-16 px-2 py-1 text-sm border border-gray-300 rounded text-right ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
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
        disabled={disabled}
        onChange={(e) => !disabled && onChange(parseFloat(e.target.value))}
        className={`w-full h-2 bg-gray-200 rounded-lg appearance-none ${disabled ? 'cursor-not-allowed' : 'cursor-pointer accent-blue-600'}`}
      />
    </div>
  )
}

export const BenchtopPanel: React.FC<BenchtopPanelProps> = ({
  isVisible,
  selectedCabinet,
  allCabinets,
  onClose,
}) => {
  // Get benchtop from carcass (using new CarcassAssembly pattern)
  const benchtop = useMemo(() => {
    return selectedCabinet?.carcass?.benchtop
  }, [selectedCabinet])

  // Local state for dimensions
  const [thickness, setThickness] = useState(38)

  // Sync state with benchtop when cabinet changes
  useEffect(() => {
    if (benchtop) {
      setThickness(benchtop.thickness)
    }
  }, [benchtop])

  // Get parent cabinet
  const parentCabinet = useMemo(() => {
    if (!selectedCabinet?.benchtopParentCabinetId) return null
    return allCabinets.find(c => c.cabinetId === selectedCabinet.benchtopParentCabinetId)
  }, [selectedCabinet?.benchtopParentCabinetId, allCabinets])

  // Handle thickness change
  const handleThicknessChange = useCallback((value: number) => {
    if (!selectedCabinet?.carcass || !parentCabinet) return
    
    setThickness(value)
    
    // Calculate effective dimensions
    const { effectiveLength } = getEffectiveBenchtopDimensions(parentCabinet, allCabinets)
    const currentDepth = selectedCabinet.carcass.dimensions.depth
    
    // Update via CarcassAssembly.updateDimensions() which calls BenchtopBuilder
    selectedCabinet.carcass.updateDimensions({
      width: effectiveLength,
      height: value,  // height = thickness for benchtop
      depth: currentDepth,
    })

    // Update position
    updateBenchtopPosition(parentCabinet, allCabinets, {
      dimensionsChanged: true,
    })
  }, [selectedCabinet, parentCabinet, allCabinets])

  if (!isVisible || !selectedCabinet) return null

  // Calculate display values
  const length = benchtop?.length || selectedCabinet.carcass?.dimensions.width || 0
  const depth = benchtop?.depth || selectedCabinet.carcass?.dimensions.depth || 0

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed top-0 right-0 h-full w-[320px] bg-white shadow-xl z-50 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Benchtop</h2>
          <p className="text-sm text-gray-500">Laminate Benchtop</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X size={20} className="text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Read-only Dimensions */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Dimensions</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500 uppercase">Length</p>
              <p className="text-lg font-semibold text-gray-800">{Math.round(length)} mm</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500 uppercase">Depth</p>
              <p className="text-lg font-semibold text-gray-800">{Math.round(depth)} mm</p>
            </div>
          </div>
        </div>

        {/* Editable Thickness */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Settings</h3>
          
          <SliderInput
            label="Thickness"
            value={thickness}
            min={20}
            max={60}
            step={1}
            onChange={handleThicknessChange}
          />
        </div>

        {/* Position Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Position</h3>
          <div className="bg-gray-50 p-3 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">X Position:</span>
              <span className="text-sm font-medium">{Math.round(selectedCabinet.group.position.x)} mm</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Y Position:</span>
              <span className="text-sm font-medium">{Math.round(selectedCabinet.group.position.y)} mm</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Z Position:</span>
              <span className="text-sm font-medium">{Math.round(selectedCabinet.group.position.z)} mm</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default BenchtopPanel
