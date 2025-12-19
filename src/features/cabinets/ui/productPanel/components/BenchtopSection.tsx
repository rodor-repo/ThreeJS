import React, { useState, useEffect, useRef, useCallback } from 'react'
import { RotateCcw } from 'lucide-react'

// Constants for overhang limits
const OVERHANG_MIN = 0
const OVERHANG_MAX = 100  // Max 100mm overhang

export interface BenchtopSectionProps {
  /** Whether this is a child benchtop (attached to a parent cabinet) */
  isChildBenchtop: boolean
  /** Overhangs for child benchtops */
  benchtopOverhangs?: {
    front: number
    left: number
    right: number
  }
  /** Overhang change callback */
  onOverhangChange?: (type: 'front' | 'left' | 'right', value: number) => void
  /** Thickness for child benchtops (min: 20, max: 60, default: 38) */
  benchtopThickness?: number
  /** Thickness change callback */
  onThicknessChange?: (value: number) => void
  /** Height from floor for independent benchtops */
  benchtopHeightFromFloor?: number
  /** Height from floor change callback */
  onHeightFromFloorChange?: (value: number) => void
  /** If true, renders only inner content without card wrapper */
  noWrapper?: boolean
}

/**
 * Reusable slider input component for benchtop settings
 */
interface SliderInputProps {
  label: string
  value: string
  propValue: number
  min: number
  max: number
  defaultValue: number
  badge?: { text: string, color: 'amber' | 'blue' | 'green' }
  onChange: (value: string) => void
  onSliderChange: (value: number) => void
  onBlur: () => void
  onReset: () => void
}

const SliderInput: React.FC<SliderInputProps> = ({
  label,
  value,
  propValue,
  min,
  max,
  defaultValue,
  badge,
  onChange,
  onSliderChange,
  onBlur,
  onReset,
}) => {
  const badgeColors = {
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        {badge && (
          <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${badgeColors[badge.color]}`}>
            {badge.text}
          </span>
        )}
      </div>
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <input
            type="number"
            className="w-20 text-center text-sm px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-tight"
            value={value}
            min={min}
            max={max}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onBlur()
              }
            }}
          />
          <button
            type="button"
            title={`Reset to default (${defaultValue}mm)`}
            onClick={onReset}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
          >
            <RotateCcw size={14} />
          </button>
          <span className="text-sm text-gray-500">mm</span>
        </div>
        <input
          type="range"
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          value={Number(value) || propValue}
          min={min}
          max={max}
          onChange={(e) => onSliderChange(Number(e.target.value))}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Benchtop-specific section component.
 * Handles overhangs for child benchtops and height from floor for independent benchtops.
 * 
 * This component follows SRP by separating benchtop-specific controls from the main DimensionsSection.
 */
export const BenchtopSection: React.FC<BenchtopSectionProps> = ({
  isChildBenchtop,
  benchtopOverhangs,
  onOverhangChange,
  benchtopThickness,
  onThicknessChange,
  benchtopHeightFromFloor,
  onHeightFromFloorChange,
  noWrapper = false,
}) => {
  // Local editing state
  const [frontOverhangEdit, setFrontOverhangEdit] = useState('')
  const [leftOverhangEdit, setLeftOverhangEdit] = useState('')
  const [rightOverhangEdit, setRightOverhangEdit] = useState('')
  const [thicknessEdit, setThicknessEdit] = useState('')
  const [heightFromFloorEdit, setHeightFromFloorEdit] = useState('')

  // Refs to track last committed values (to avoid resetting during local edits)
  const lastCommittedOverhangs = useRef({ front: -1, left: -1, right: -1 })
  const lastCommittedThickness = useRef(-1)
  const lastCommittedHeight = useRef(-1)

  // Refs to track last received prop values (to distinguish between old props and external changes)
  const lastReceivedOverhangs = useRef({ front: -1, left: -1, right: -1 })
  const lastReceivedThickness = useRef(-1)
  const lastReceivedHeight = useRef(-1)

  // Initialize and sync from props only when they change externally
  useEffect(() => {
    if (benchtopOverhangs) {
      // Check for changes in each overhang value
      // We only sync if the prop is different from both our last committed value AND the last prop we processed
      // This prevents "resetting" to an old prop value during rapid updates
      
      if (benchtopOverhangs.front !== lastReceivedOverhangs.current.front) {
        if (benchtopOverhangs.front !== lastCommittedOverhangs.current.front) {
          setFrontOverhangEdit(benchtopOverhangs.front.toString())
          lastCommittedOverhangs.current.front = benchtopOverhangs.front
        }
        lastReceivedOverhangs.current.front = benchtopOverhangs.front
      }
      
      if (benchtopOverhangs.left !== lastReceivedOverhangs.current.left) {
        if (benchtopOverhangs.left !== lastCommittedOverhangs.current.left) {
          setLeftOverhangEdit(benchtopOverhangs.left.toString())
          lastCommittedOverhangs.current.left = benchtopOverhangs.left
        }
        lastReceivedOverhangs.current.left = benchtopOverhangs.left
      }
      
      if (benchtopOverhangs.right !== lastReceivedOverhangs.current.right) {
        if (benchtopOverhangs.right !== lastCommittedOverhangs.current.right) {
          setRightOverhangEdit(benchtopOverhangs.right.toString())
          lastCommittedOverhangs.current.right = benchtopOverhangs.right
        }
        lastReceivedOverhangs.current.right = benchtopOverhangs.right
      }
    }
  }, [benchtopOverhangs])

  useEffect(() => {
    if (benchtopThickness !== undefined) {
      if (benchtopThickness !== lastReceivedThickness.current) {
        if (benchtopThickness !== lastCommittedThickness.current) {
          setThicknessEdit(benchtopThickness.toString())
          lastCommittedThickness.current = benchtopThickness
        }
        lastReceivedThickness.current = benchtopThickness
      }
    }
  }, [benchtopThickness])

  useEffect(() => {
    if (benchtopHeightFromFloor !== undefined) {
      if (benchtopHeightFromFloor !== lastReceivedHeight.current) {
        if (benchtopHeightFromFloor !== lastCommittedHeight.current) {
          setHeightFromFloorEdit(benchtopHeightFromFloor.toString())
          lastCommittedHeight.current = benchtopHeightFromFloor
        }
        lastReceivedHeight.current = benchtopHeightFromFloor
      }
    }
  }, [benchtopHeightFromFloor])

  // Overhang handlers
  const handleOverhangSliderChange = useCallback((type: 'front' | 'left' | 'right', value: number) => {
    const clampedValue = Math.max(OVERHANG_MIN, Math.min(OVERHANG_MAX, value))
    
    if (type === 'front') {
      setFrontOverhangEdit(clampedValue.toString())
      lastCommittedOverhangs.current.front = clampedValue
    } else if (type === 'left') {
      setLeftOverhangEdit(clampedValue.toString())
      lastCommittedOverhangs.current.left = clampedValue
    } else {
      setRightOverhangEdit(clampedValue.toString())
      lastCommittedOverhangs.current.right = clampedValue
    }
    
    onOverhangChange?.(type, clampedValue)
  }, [onOverhangChange])

  const handleOverhangBlur = useCallback((type: 'front' | 'left' | 'right', editValue: string, originalValue: number) => {
    const numValue = parseFloat(editValue)
    if (!isNaN(numValue) && numValue >= OVERHANG_MIN && numValue <= OVERHANG_MAX) {
      const clampedValue = Math.max(OVERHANG_MIN, Math.min(OVERHANG_MAX, numValue))
      
      if (type === 'front') {
        setFrontOverhangEdit(clampedValue.toString())
        lastCommittedOverhangs.current.front = clampedValue
      } else if (type === 'left') {
        setLeftOverhangEdit(clampedValue.toString())
        lastCommittedOverhangs.current.left = clampedValue
      } else {
        setRightOverhangEdit(clampedValue.toString())
        lastCommittedOverhangs.current.right = clampedValue
      }
      
      onOverhangChange?.(type, clampedValue)
    } else {
      // Reset to original value if invalid
      if (type === 'front') setFrontOverhangEdit(originalValue.toString())
      if (type === 'left') setLeftOverhangEdit(originalValue.toString())
      if (type === 'right') setRightOverhangEdit(originalValue.toString())
    }
  }, [onOverhangChange])

  const handleOverhangReset = useCallback((type: 'front' | 'left' | 'right') => {
    const defaultValue = type === 'front' ? 20 : 0
    
    if (type === 'front') {
      setFrontOverhangEdit(defaultValue.toString())
      lastCommittedOverhangs.current.front = defaultValue
    } else if (type === 'left') {
      setLeftOverhangEdit(defaultValue.toString())
      lastCommittedOverhangs.current.left = defaultValue
    } else {
      setRightOverhangEdit(defaultValue.toString())
      lastCommittedOverhangs.current.right = defaultValue
    }
    
    onOverhangChange?.(type, defaultValue)
  }, [onOverhangChange])

  // Thickness handlers
  const handleThicknessSliderChange = useCallback((value: number) => {
    const clampedValue = Math.max(20, Math.min(60, value))
    setThicknessEdit(clampedValue.toString())
    lastCommittedThickness.current = clampedValue
    onThicknessChange?.(clampedValue)
  }, [onThicknessChange])

  const handleThicknessBlur = useCallback(() => {
    const numValue = parseFloat(thicknessEdit)
    const originalValue = benchtopThickness ?? 38
    
    if (!isNaN(numValue) && numValue >= 20 && numValue <= 60) {
      setThicknessEdit(numValue.toString())
      lastCommittedThickness.current = numValue
      onThicknessChange?.(numValue)
    } else {
      setThicknessEdit(originalValue.toString())
    }
  }, [thicknessEdit, benchtopThickness, onThicknessChange])

  const handleThicknessReset = useCallback(() => {
    setThicknessEdit('38')
    lastCommittedThickness.current = 38
    onThicknessChange?.(38)
  }, [onThicknessChange])

  // Height from floor handlers
  const handleHeightSliderChange = useCallback((value: number) => {
    const clampedValue = Math.max(0, Math.min(1200, value))
    setHeightFromFloorEdit(clampedValue.toString())
    lastCommittedHeight.current = clampedValue
    onHeightFromFloorChange?.(clampedValue)
  }, [onHeightFromFloorChange])

  const handleHeightBlur = useCallback(() => {
    const numValue = parseFloat(heightFromFloorEdit)
    const originalValue = benchtopHeightFromFloor ?? 740
    
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 1200) {
      setHeightFromFloorEdit(numValue.toString())
      lastCommittedHeight.current = numValue
      onHeightFromFloorChange?.(numValue)
    } else {
      setHeightFromFloorEdit(originalValue.toString())
    }
  }, [heightFromFloorEdit, benchtopHeightFromFloor, onHeightFromFloorChange])

  const handleHeightReset = useCallback(() => {
    setHeightFromFloorEdit('740')
    lastCommittedHeight.current = 740
    onHeightFromFloorChange?.(740)
  }, [onHeightFromFloorChange])

  const content = (
    <div className="space-y-4">
      {/* Thickness slider - Only for child benchtops */}
      {isChildBenchtop && benchtopThickness !== undefined && onThicknessChange && (
        <SliderInput
          label="Thickness"
          value={thicknessEdit}
          propValue={benchtopThickness}
          min={20}
          max={60}
          defaultValue={38}
          badge={{ text: 'Size', color: 'amber' }}
          onChange={setThicknessEdit}
          onSliderChange={handleThicknessSliderChange}
          onBlur={handleThicknessBlur}
          onReset={handleThicknessReset}
        />
      )}

      {/* Overhang sliders - Only for child benchtops */}
      {isChildBenchtop && benchtopOverhangs && onOverhangChange && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Overhangs</h4>
          
          {/* Front Overhang */}
          <SliderInput
            label="Front"
            value={frontOverhangEdit}
            propValue={benchtopOverhangs.front}
            min={OVERHANG_MIN}
            max={OVERHANG_MAX}
            defaultValue={20}
            badge={{ text: 'Depth', color: 'green' }}
            onChange={setFrontOverhangEdit}
            onSliderChange={(v) => handleOverhangSliderChange('front', v)}
            onBlur={() => handleOverhangBlur('front', frontOverhangEdit, benchtopOverhangs.front)}
            onReset={() => handleOverhangReset('front')}
          />
          
          {/* Left Overhang */}
          <SliderInput
            label="Left"
            value={leftOverhangEdit}
            propValue={benchtopOverhangs.left}
            min={OVERHANG_MIN}
            max={OVERHANG_MAX}
            defaultValue={0}
            badge={{ text: 'Width', color: 'blue' }}
            onChange={setLeftOverhangEdit}
            onSliderChange={(v) => handleOverhangSliderChange('left', v)}
            onBlur={() => handleOverhangBlur('left', leftOverhangEdit, benchtopOverhangs.left)}
            onReset={() => handleOverhangReset('left')}
          />
          
          {/* Right Overhang */}
          <SliderInput
            label="Right"
            value={rightOverhangEdit}
            propValue={benchtopOverhangs.right}
            min={OVERHANG_MIN}
            max={OVERHANG_MAX}
            defaultValue={0}
            badge={{ text: 'Width', color: 'blue' }}
            onChange={setRightOverhangEdit}
            onSliderChange={(v) => handleOverhangSliderChange('right', v)}
            onBlur={() => handleOverhangBlur('right', rightOverhangEdit, benchtopOverhangs.right)}
            onReset={() => handleOverhangReset('right')}
          />
        </div>
      )}

      {/* Height from Floor - Only for independent benchtops */}
      {!isChildBenchtop && benchtopHeightFromFloor !== undefined && onHeightFromFloorChange && (
        <SliderInput
          label="Height (Underneath)"
          value={heightFromFloorEdit}
          propValue={benchtopHeightFromFloor}
          min={0}
          max={1200}
          defaultValue={740}
          badge={{ text: 'Position', color: 'blue' }}
          onChange={setHeightFromFloorEdit}
          onSliderChange={handleHeightSliderChange}
          onBlur={handleHeightBlur}
          onReset={handleHeightReset}
        />
      )}
    </div>
  )

  if (noWrapper) {
    return content
  }

  return (
    <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
      <div className="flex items-center space-x-2 text-gray-700 font-medium mb-2.5">
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
          <rect x="3" y="8" width="18" height="4" rx="1" />
          <path d="M5 12v8" />
          <path d="M19 12v8" />
        </svg>
        <h3>Benchtop Settings</h3>
      </div>
      {content}
    </div>
  )
}

export default BenchtopSection
