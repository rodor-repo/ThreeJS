import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, Plus, Trash2 } from 'lucide-react'
import type { WallDimensions, CabinetData } from '../types'
import { WALL_THICKNESS } from '../lib/sceneUtils'
import type { View, ViewManager, ViewId } from '@/features/cabinets/ViewManager'

type Props = {
  isOpen: boolean
  onClose: () => void
  wallDimensions: WallDimensions
  wallColor: string
  activeViews: View[]
  cabinets: CabinetData[]
  viewManager: ViewManager
  onApply: (dims: WallDimensions, color: string) => void
}

export const WallSettingsDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  wallDimensions,
  wallColor,
  activeViews,
  cabinets,
  viewManager,
  onApply,
}) => {
  const [tempHeight, setTempHeight] = useState(wallDimensions.height)
  const [tempBackWallLength, setTempBackWallLength] = useState(wallDimensions.backWallLength ?? wallDimensions.length)
  const [tempLeftWallLength, setTempLeftWallLength] = useState(wallDimensions.leftWallLength ?? 600)
  const [tempRightWallLength, setTempRightWallLength] = useState(wallDimensions.rightWallLength ?? 600)
  const [tempLeftWallVisible, setTempLeftWallVisible] = useState(wallDimensions.leftWallVisible ?? true)
  const [tempRightWallVisible, setTempRightWallVisible] = useState(wallDimensions.rightWallVisible ?? true)
  const [tempAdditionalWalls, setTempAdditionalWalls] = useState<Array<{ id: string; length: number; distanceFromLeft: number; thickness?: number; viewId?: ViewId }>>(
    wallDimensions.additionalWalls?.map(wall => ({ ...wall, viewId: (wall as any).viewId })) ?? []
  )
  const [tempWallColor, setTempWallColor] = useState(wallColor)
  const [rightWallViewId, setRightWallViewId] = useState<ViewId | ''>((wallDimensions as any).rightWallViewId || '')

  useEffect(() => {
    if (isOpen) {
      setTempHeight(wallDimensions.height)
      setTempBackWallLength(wallDimensions.backWallLength ?? wallDimensions.length)
      setTempLeftWallLength(wallDimensions.leftWallLength ?? 600)
      setTempRightWallLength(wallDimensions.rightWallLength ?? 600)
      setTempLeftWallVisible(wallDimensions.leftWallVisible ?? true)
      setTempRightWallVisible(wallDimensions.rightWallVisible ?? true)
      setTempAdditionalWalls(wallDimensions.additionalWalls?.map(wall => ({ ...wall, viewId: (wall as any).viewId })) ?? [])
      setTempWallColor(wallColor)
      setRightWallViewId((wallDimensions as any).rightWallViewId || '')
    }
  }, [isOpen, wallColor, wallDimensions])

  const handleAddAdditionalWall = () => {
    const newWall = {
      id: `wall-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      length: 600, // Default: 600mm
      distanceFromLeft: tempBackWallLength / 2, // Default: Half of back wall length
      thickness: WALL_THICKNESS, // Default: Back wall thickness
    }
    setTempAdditionalWalls([...tempAdditionalWalls, newWall])
  }

  const handleRemoveAdditionalWall = (id: string) => {
    setTempAdditionalWalls(tempAdditionalWalls.filter(wall => wall.id !== id))
  }

  const handleUpdateAdditionalWall = (id: string, field: 'length' | 'distanceFromLeft' | 'thickness', value: number) => {
    const updatedWalls = tempAdditionalWalls.map(wall =>
      wall.id === id ? { ...wall, [field]: value } : wall
    )
    setTempAdditionalWalls(updatedWalls)
  }

  // Calculate the rightmost X position (right edge) of cabinets in a view
  const calculateRightmostPositionInView = (viewId: ViewId): number => {
    if (!viewId || viewId === 'none') return 0
    
    const cabinetIds = viewManager.getCabinetsInView(viewId)
    const viewCabinets = cabinets.filter(c => cabinetIds.includes(c.cabinetId))
    
    if (viewCabinets.length === 0) return 0
    
    // Find the rightmost edge: cabinet X position + cabinet width
    let rightmostX = 0
    viewCabinets.forEach(cabinet => {
      const cabinetRightEdge = cabinet.group.position.x + cabinet.carcass.dimensions.width
      if (cabinetRightEdge > rightmostX) {
        rightmostX = cabinetRightEdge
      }
    })
    
    return rightmostX
  }

  // Handle Right Wall view selection
  const handleRightWallViewChange = (viewId: string) => {
    const selectedViewId = viewId as ViewId
    setRightWallViewId(selectedViewId)
    
    if (selectedViewId && selectedViewId !== 'none') {
      // Calculate rightmost position in the selected view
      const rightmostX = calculateRightmostPositionInView(selectedViewId)
      
      // Update Back Wall length to match rightmost position
      // Right Wall's left corner will be at rightmostX
      setTempBackWallLength(rightmostX)
      
      // Apply changes immediately
      onApply(
        {
          height: Math.max(100, tempHeight),
          length: Math.max(100, rightmostX),
          backWallLength: Math.max(100, rightmostX),
          leftWallLength: Math.max(100, tempLeftWallLength),
          rightWallLength: Math.max(100, tempRightWallLength),
          leftWallVisible: tempLeftWallVisible,
          rightWallVisible: tempRightWallVisible,
          rightWallViewId: selectedViewId,
          additionalWalls: tempAdditionalWalls,
        },
        tempWallColor
      )
    } else {
      // No view selected - apply without view constraint
      onApply(
        {
          height: Math.max(100, tempHeight),
          length: Math.max(100, tempBackWallLength),
          backWallLength: Math.max(100, tempBackWallLength),
          leftWallLength: Math.max(100, tempLeftWallLength),
          rightWallLength: Math.max(100, tempRightWallLength),
          leftWallVisible: tempLeftWallVisible,
          rightWallVisible: tempRightWallVisible,
          rightWallViewId: undefined,
          additionalWalls: tempAdditionalWalls,
        },
        tempWallColor
      )
    }
  }

  // Handle Internal Wall view selection
  const handleInternalWallViewChange = (wallId: string, viewId: string) => {
    const selectedViewId = viewId as ViewId
    
    // Update the wall's viewId
    const updatedWalls = tempAdditionalWalls.map(wall =>
      wall.id === wallId ? { ...wall, viewId: selectedViewId || undefined } : wall
    )
    setTempAdditionalWalls(updatedWalls)
    
    // For internal walls, position is based on distanceFromLeft
    // The wall's left corner will be at distanceFromLeft (no Back Wall adjustment)
    // This is handled by the existing distanceFromLeft field, so we just need to apply changes
    onApply(
      {
        height: Math.max(100, tempHeight),
        length: Math.max(100, tempBackWallLength),
        backWallLength: Math.max(100, tempBackWallLength),
        leftWallLength: Math.max(100, tempLeftWallLength),
        rightWallLength: Math.max(100, tempRightWallLength),
        leftWallVisible: tempLeftWallVisible,
        rightWallVisible: tempRightWallVisible,
        rightWallViewId: rightWallViewId || undefined,
        additionalWalls: updatedWalls,
      },
      tempWallColor
    )
  }

  // Apply changes function - called when input loses focus
  const applyChanges = () => {
    // If Right Wall has a view selected, recalculate Back Wall length
    let finalBackWallLength = tempBackWallLength
    if (rightWallViewId && rightWallViewId !== 'none') {
      const rightmostX = calculateRightmostPositionInView(rightWallViewId)
      finalBackWallLength = Math.max(100, rightmostX)
    }
    
    onApply(
      {
        height: Math.max(100, tempHeight),
        length: Math.max(100, finalBackWallLength), // Keep for backward compatibility
        backWallLength: Math.max(100, finalBackWallLength),
        leftWallLength: Math.max(100, tempLeftWallLength),
        rightWallLength: Math.max(100, tempRightWallLength),
        leftWallVisible: tempLeftWallVisible,
        rightWallVisible: tempRightWallVisible,
        rightWallViewId: rightWallViewId || undefined,
        additionalWalls: tempAdditionalWalls,
      },
      tempWallColor
    )
  }

  // Apply changes immediately for checkboxes and color picker (no typing involved)
  useEffect(() => {
    if (isOpen) {
      onApply(
        {
          height: Math.max(100, tempHeight),
          length: Math.max(100, tempBackWallLength), // Keep for backward compatibility
          backWallLength: Math.max(100, tempBackWallLength),
          leftWallLength: Math.max(100, tempLeftWallLength),
          rightWallLength: Math.max(100, tempRightWallLength),
          leftWallVisible: tempLeftWallVisible,
          rightWallVisible: tempRightWallVisible,
          rightWallViewId: rightWallViewId || undefined,
          additionalWalls: tempAdditionalWalls,
        },
        tempWallColor
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempLeftWallVisible, tempRightWallVisible, tempWallColor, isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-30 z-[60]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
            className="fixed top-0 right-0 h-full w-96 bg-white shadow-xl z-[70] overflow-y-auto"
            data-wall-drawer
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center gap-3">
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ChevronLeft size={24} />
              </button>
              <h2 className="text-xl font-bold text-gray-800 flex-1">Wall Settings</h2>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              <div>
                <label
                  htmlFor="height"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Height (mm)
                </label>
                <input
                  type="number"
                  id="height"
                  value={tempHeight}
                  onChange={(e) => setTempHeight(Number(e.target.value) || 0)}
                  onBlur={applyChanges}
                  min={100}
                  max={10000}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="backWallLength"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Back Wall Length (mm)
                </label>
                <input
                  type="number"
                  id="backWallLength"
                  value={tempBackWallLength}
                  onChange={(e) => setTempBackWallLength(Number(e.target.value) || 0)}
                  onBlur={applyChanges}
                  min={100}
                  max={20000}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="checkbox"
                    id="leftWallVisible"
                    checked={tempLeftWallVisible}
                    onChange={(e) => setTempLeftWallVisible(e.target.checked)}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label
                    htmlFor="leftWallVisible"
                    className="block text-sm font-medium text-gray-700 flex-1"
                  >
                    Left Wall
                  </label>
                </div>
                {tempLeftWallVisible && (
                  <div className="ml-8">
                    <label
                      htmlFor="leftWallLength"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Left Wall Length (mm)
                    </label>
                    <input
                      type="number"
                      id="leftWallLength"
                      value={tempLeftWallLength}
                      onChange={(e) => setTempLeftWallLength(Number(e.target.value) || 0)}
                      onBlur={applyChanges}
                      min={100}
                      max={20000}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="checkbox"
                    id="rightWallVisible"
                    checked={tempRightWallVisible}
                    onChange={(e) => setTempRightWallVisible(e.target.checked)}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label
                    htmlFor="rightWallVisible"
                    className="block text-sm font-medium text-gray-700 flex-1"
                  >
                    Right Wall
                  </label>
                </div>
                {tempRightWallVisible && (
                  <div className="ml-8 space-y-4">
                    <div>
                      <label
                        htmlFor="rightWallLength"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Right Wall Length (mm)
                      </label>
                      <input
                        type="number"
                        id="rightWallLength"
                        value={tempRightWallLength}
                        onChange={(e) => setTempRightWallLength(Number(e.target.value) || 0)}
                        onBlur={applyChanges}
                        min={100}
                        max={20000}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="rightWallView"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        View
                      </label>
                      <select
                        id="rightWallView"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        value={rightWallViewId}
                        onChange={(e) => handleRightWallViewChange(e.target.value)}
                      >
                        <option value="">Select a view...</option>
                        {activeViews.map((view) => (
                          <option key={view.id} value={view.id}>
                            {view.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-700">Additional Walls</h3>
                  <button
                    onClick={handleAddAdditionalWall}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={16} />
                    Add Wall
                  </button>
                </div>
                {tempAdditionalWalls.length > 0 && (
                  <div className="space-y-4">
                    {tempAdditionalWalls.map((wall, index) => (
                      <div key={wall.id} className="bg-gray-50 p-3 rounded-md space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">Wall {index + 1}</span>
                          <button
                            onClick={() => handleRemoveAdditionalWall(wall.id)}
                            className="text-red-600 hover:text-red-700 transition-colors"
                            title="Remove wall"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div>
                          <label
                            htmlFor={`wall-${wall.id}-length`}
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Length (mm)
                          </label>
                          <input
                            type="number"
                            id={`wall-${wall.id}-length`}
                            value={wall.length}
                            onChange={(e) => handleUpdateAdditionalWall(wall.id, 'length', Number(e.target.value) || 0)}
                            onBlur={applyChanges}
                            min={100}
                            max={20000}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`wall-${wall.id}-distance`}
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Distance from Left (mm)
                          </label>
                          <input
                            type="number"
                            id={`wall-${wall.id}-distance`}
                            value={wall.distanceFromLeft}
                            onChange={(e) => handleUpdateAdditionalWall(wall.id, 'distanceFromLeft', Number(e.target.value) || 0)}
                            onBlur={applyChanges}
                            min={0}
                            max={20000}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`wall-${wall.id}-thickness`}
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Thickness (mm)
                          </label>
                          <input
                            type="number"
                            id={`wall-${wall.id}-thickness`}
                            value={wall.thickness ?? WALL_THICKNESS}
                            onChange={(e) => handleUpdateAdditionalWall(wall.id, 'thickness', Number(e.target.value) || WALL_THICKNESS)}
                            onBlur={applyChanges}
                            min={10}
                            max={500}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`wall-${wall.id}-view-thickness`}
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            View
                          </label>
                          <select
                            id={`wall-${wall.id}-view-thickness`}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            value={wall.viewId || ''}
                            onChange={(e) => handleInternalWallViewChange(wall.id, e.target.value)}
                          >
                            <option value="">Select a view...</option>
                            {activeViews.map((view) => (
                              <option key={view.id} value={view.id}>
                                {view.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="wallColor"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Wall Color
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    id="wallColor"
                    value={tempWallColor}
                    onChange={(e) => setTempWallColor(e.target.value)}
                    className="w-16 h-12 border border-gray-300 rounded-md cursor-pointer"
                    title="Click to change wall color"
                  />
                  <input
                    type="text"
                    value={tempWallColor}
                    onChange={(e) => setTempWallColor(e.target.value)}
                    onBlur={applyChanges}
                    placeholder="#dcbfa0"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>
                <div className="flex items-center space-x-2 mt-2 text-sm text-gray-600">
                  <span>Preview:</span>
                  <div
                    className="w-6 h-6 rounded border border-gray-300"
                    style={{ backgroundColor: tempWallColor }}
                    title={`Preview: ${tempWallColor}`}
                  />
                  <span className="font-mono text-xs">{tempWallColor}</span>
                </div>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

