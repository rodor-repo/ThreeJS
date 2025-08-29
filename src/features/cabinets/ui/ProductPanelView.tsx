import React from 'react'
import { ChevronLeft, ChevronRight, Settings, Palette, Ruler, DoorOpen } from 'lucide-react'
import type { CarcassDimensions } from '@/components/Carcass'
import type { ProductPanelProps } from './product-panel.types'
import DebugBalanceButton from './DebugBalanceButton'

export type ProductPanelViewProps = ProductPanelProps & {
  state: {
    isExpanded: boolean
    setIsExpanded: (v: boolean) => void
    dimensions: CarcassDimensions
    materialColor: string
    materialThickness: number
    kickerHeight: number
    doorEnabled: boolean
    doorColor: string
    doorThickness: number
    doorCount: number
    doorCountAutoAdjusted: boolean
    overhangDoor: boolean
    drawerEnabled: boolean
    drawerQuantity: number
    drawerHeights: number[]
    isEditingDrawerHeights: boolean
    isEditingDimensions: boolean
    isOneDoorAllowed: () => boolean
    isDrawerCabinet: () => boolean
    dimensionConstraints: { height: any, width: any, depth: any }
  }
  handlers: {
    handleDimensionChange: (field: keyof CarcassDimensions, value: number) => void
    handleMaterialChange: (field: 'colour' | 'panelThickness', value: string | number) => void
    handleKickerHeightChange: (value: number) => void
    handleDoorToggle: (enabled: boolean) => void
    handleOverhangDoorToggle: (enabled: boolean) => void
    handleDoorMaterialChange: (field: 'colour' | 'thickness', value: string | number) => void
    handleDoorCountChange: (count: number) => void
    handleDrawerToggle: (enabled: boolean) => void
    handleDrawerQuantityChange: (quantity: number) => void
    handleDrawerHeightChange: (index: number, height: number) => void
    updateDrawerHeightLocal: (index: number, value: number) => void
    recalculateDrawerHeights: () => void
    onDrawerHeightsBalance?: () => void
    onDrawerHeightsReset?: () => void
    setIsEditingDrawerHeights: (v: boolean) => void
    setIsEditingDimensions?: (v: boolean) => void
    debugBalanceTest?: () => number[] | void
  }
}

const doorMaterials = [
  { id: 'standard-door', name: 'Standard Door', colour: '#ffffff', thickness: 18 },
  { id: 'premium-door', name: 'Premium Door', colour: '#654321', thickness: 18 },
  { id: 'light-door', name: 'Light Door', colour: '#DEB887', thickness: 18 },
  { id: 'thick-door', name: 'Thick Door', colour: '#ffffff', thickness: 25 },
  { id: 'glass-door', name: 'Glass Door', colour: '#87CEEB', thickness: 6 }
]

export const ProductPanelView: React.FC<ProductPanelViewProps> = ({
  isVisible,
  onClose,
  selectedCabinet,
  state,
  handlers
}) => {
  if (!isVisible) return null

  const {
    isExpanded,
    setIsExpanded,
    dimensions,
    materialColor,
    materialThickness,
    kickerHeight,
    doorEnabled,
    doorColor,
    doorThickness,
    doorCount,
    doorCountAutoAdjusted,
    overhangDoor,
    drawerEnabled,
    drawerQuantity,
    drawerHeights,
    isEditingDimensions,
    isOneDoorAllowed,
    isDrawerCabinet,
    dimensionConstraints
  } = state

  const {
    handleDimensionChange,
    handleMaterialChange,
    handleKickerHeightChange,
    handleDoorToggle,
    handleOverhangDoorToggle,
    handleDoorMaterialChange,
    handleDoorCountChange,
    handleDrawerToggle,
    handleDrawerQuantityChange,
    handleDrawerHeightChange,
    updateDrawerHeightLocal,
    recalculateDrawerHeights,
    onDrawerHeightsBalance,
    onDrawerHeightsReset,
    setIsEditingDrawerHeights,
    setIsEditingDimensions,
    debugBalanceTest
  } = handlers

  return (
    <div
      className="fixed right-0 top-0 h-full bg-white shadow-lg border-l border-gray-200 transition-all duration-300 ease-in-out z-50 product-panel"
      data-product-panel="true"
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onMouseUp={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
    >
      <button
        onClick={e => { e.stopPropagation(); setIsExpanded(!isExpanded) }}
        onMouseDown={e => e.stopPropagation()}
        onMouseUp={e => e.stopPropagation()}
        className="absolute -left-3 top-1/2 transform -translate-y-1/2 bg-blue-600 text-white rounded-full p-1 hover:bg-blue-700 transition-colors"
      >
        {isExpanded ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <div
        className={`h-full transition-all duration-300 ease-in-out ${isExpanded ? 'w-80 sm:w-80 max-w-[90vw]' : 'w-0'} overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100`}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onMouseUp={e => e.stopPropagation()}
        onWheel={e => e.stopPropagation()}
      >
        <div className="bg-gray-50 px-2 sm:px-4 py-2 sm:py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Product Panel</h2>
            <button onClick={e => { e.stopPropagation(); onClose() }} className="text-gray-500 hover:text-gray-700 transition-colors">×</button>
          </div>
          {selectedCabinet && (
            <p className="text-sm text-gray-600 mt-1">
              {selectedCabinet.cabinetType.charAt(0).toUpperCase() + selectedCabinet.cabinetType.slice(1)} Cabinet
            </p>
          )}
        </div>

        <div className="p-2 sm:p-4 space-y-1 min-h-full">
          {selectedCabinet ? (
            <>
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-gray-700 font-medium">
                  <Ruler size={20} />
                  <h3>Dimensions</h3>
                </div>

                <div className="space-y-4">
                  {/* Height */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Height (mm)</label>
                    <div className="text-center mb-3">
                      <input
                        type="number"
                        value={dimensions.height}
                        onChange={e => handleDimensionChange('height', Number(e.target.value))}
                        onFocus={() => setIsEditingDimensions?.(true)}
                        onBlur={() => setTimeout(() => setIsEditingDimensions?.(false), 100)}
                        className="text-center text-lg font-semibold text-blue-600 bg-transparent border-b-2 border-blue-300 focus:border-blue-500 focus:outline-none px-2 py-1 w-24"
                        min={dimensionConstraints.height.min}
                        max={dimensionConstraints.height.max}
                        step="10"
                      />
                      <span className="text-lg font-semibold text-blue-600 ml-1">mm</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-xs text-gray-500 w-12">{dimensionConstraints.height.min}</span>
                      <input
                        type="range"
                        value={dimensions.height}
                        onChange={e => handleDimensionChange('height', Number(e.target.value))}
                        onMouseDown={e => { e.stopPropagation(); setIsEditingDimensions?.(true) }}
                        onMouseUp={e => { e.stopPropagation(); setTimeout(() => setIsEditingDimensions?.(false), 100) }}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        min={dimensionConstraints.height.min}
                        max={dimensionConstraints.height.max}
                        step="10"
                      />
                      <span className="text-xs text-gray-500 w-12">{dimensionConstraints.height.max}</span>
                    </div>
                  </div>

                  {/* Width */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Width (mm)</label>
                    <div className="text-center mb-3">
                      <input
                        type="number"
                        value={dimensions.width}
                        onChange={e => handleDimensionChange('width', Number(e.target.value))}
                        onFocus={() => setIsEditingDimensions?.(true)}
                        onBlur={() => setTimeout(() => setIsEditingDimensions?.(false), 100)}
                        className="text-center text-lg font-semibold text-blue-600 bg-transparent border-b-2 border-blue-300 focus:border-blue-500 focus:outline-none px-2 py-1 w-24"
                        min={dimensionConstraints.width.min}
                        max={dimensionConstraints.width.max}
                        step="10"
                      />
                      <span className="text-lg font-semibold text-blue-600 ml-1">mm</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-xs text-gray-500 w-12">{dimensionConstraints.width.min}</span>
                      <input
                        type="range"
                        value={dimensions.width}
                        onChange={e => handleDimensionChange('width', Number(e.target.value))}
                        onMouseDown={e => { e.stopPropagation(); setIsEditingDimensions?.(true) }}
                        onMouseUp={e => { e.stopPropagation(); setTimeout(() => setIsEditingDimensions?.(false), 100) }}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        min={dimensionConstraints.width.min}
                        max={dimensionConstraints.width.max}
                        step="10"
                      />
                      <span className="text-xs text-gray-500 w-12">{dimensionConstraints.width.max}</span>
                    </div>
                  </div>

                  {/* Depth */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Depth (mm)</label>
                    <div className="text-center mb-3">
                      <input
                        type="number"
                        value={dimensions.depth}
                        onChange={e => handleDimensionChange('depth', Number(e.target.value))}
                        onFocus={() => setIsEditingDimensions?.(true)}
                        onBlur={() => setTimeout(() => setIsEditingDimensions?.(false), 100)}
                        className="text-center text-lg font-semibold text-blue-600 bg-transparent border-b-2 border-blue-300 focus:border-blue-500 focus:outline-none px-2 py-1 w-24"
                        min={dimensionConstraints.depth.min}
                        max={dimensionConstraints.depth.max}
                        step="10"
                      />
                      <span className="text-lg font-semibold text-blue-600 ml-1">mm</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-xs text-gray-500 w-12">{dimensionConstraints.depth.min}</span>
                      <input
                        type="range"
                        value={dimensions.depth}
                        onChange={e => handleDimensionChange('depth', Number(e.target.value))}
                        onMouseDown={e => { e.stopPropagation(); setIsEditingDimensions?.(true) }}
                        onMouseUp={e => { e.stopPropagation(); setTimeout(() => setIsEditingDimensions?.(false), 100) }}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        min={dimensionConstraints.depth.min}
                        max={dimensionConstraints.depth.max}
                        step="10"
                      />
                      <span className="text-xs text-gray-500 w-12">{dimensionConstraints.depth.max}</span>
                    </div>
                  </div>
                </div>
              </div>

              {(selectedCabinet?.cabinetType === 'base' || selectedCabinet?.cabinetType === 'tall') && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Kicker Height (mm)</label>
                    <div className="text-center mb-3">
                      <input
                        type="number"
                        value={kickerHeight}
                        onChange={e => handlers.handleKickerHeightChange(Number(e.target.value))}
                        className="text-center text-lg font-semibold text-blue-600 bg-transparent border-b-2 border-blue-300 focus:border-blue-500 focus:outline-none px-2 py-1 w-24"
                        min="50"
                        max="200"
                        step="5"
                      />
                      <span className="text-lg font-semibold text-blue-600 ml-1">mm</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-xs text-gray-500 w-12">50</span>
                      <input
                        type="range"
                        value={kickerHeight}
                        onChange={e => handlers.handleKickerHeightChange(Number(e.target.value))}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        min="50"
                        max="200"
                        step="5"
                      />
                      <span className="text-xs text-gray-500 w-12">200</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Controls the height of cabinet legs (Base and Tall cabinets only)</p>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-gray-700 font-medium">
                  <Palette size={20} />
                  <h3>Material Properties</h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Carcass Colour</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={materialColor}
                        onChange={e => handleMaterialChange('colour', e.target.value)}
                        className="w-12 h-10 border border-gray-300 rounded-md cursor-pointer"
                      />
                      <input
                        type="text"
                        value={materialColor}
                        onChange={e => handleMaterialChange('colour', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="#ffffff"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Carcass Thickness</label>
                    <input
                      type="number"
                      value={materialThickness}
                      onChange={e => handleMaterialChange('panelThickness', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="6"
                      max="50"
                      step="1"
                    />
                    <p className="text-xs text-gray-500 mt-1">This will update both panel and back panel thickness</p>
                  </div>
                </div>
              </div>

              {!isDrawerCabinet() && (
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 mb-4">
                    <DoorOpen size={20} />
                    <h3>Door Settings</h3>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={doorEnabled}
                          onChange={e => handleDoorToggle(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Enable Doors</span>
                      </label>
                    </div>

                    {doorEnabled && selectedCabinet?.cabinetType === 'top' && (
                      <div>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={overhangDoor}
                            onChange={e => handleOverhangDoorToggle(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-700">Overhang Door</span>
                        </label>
                        <p className="text-xs text-gray-500 mt-1 ml-6">Makes door 20mm longer and positions it 20mm lower (Top/Wall cabinets only)</p>
                      </div>
                    )}

                    {doorEnabled && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Number of Doors</label>
                        <select
                          value={doorCount}
                          onChange={e => handleDoorCountChange(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          disabled={!isOneDoorAllowed()}
                        >
                          <option value={1} disabled={!isOneDoorAllowed()}>1 Door</option>
                          <option value={2}>2 Doors</option>
                        </select>
                        {!isOneDoorAllowed() && (
                          <p className="text-xs text-blue-600 mt-1">ⓘ {doorCountAutoAdjusted ? 'Auto-switched to 2 doors' : '2 doors required'} for cabinets wider than 600mm</p>
                        )}
                      </div>
                    )}

                    {doorEnabled && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Door Gap (mm)</label>
                        <div className="text-center mb-3">
                          <input
                            type="number"
                            value={2}
                            disabled
                            className="text-center text-lg font-semibold text-gray-400 bg-gray-100 border-b-2 border-gray-300 px-2 py-1 w-24 cursor-not-allowed"
                            min="1"
                            max="5"
                            step="0.5"
                          />
                          <span className="text-lg font-semibold text-gray-400 ml-1">mm</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Gap between doors and carcass edges (read-only)</p>
                      </div>
                    )}

                    {doorEnabled && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Door Colour</label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="color"
                            value={doorColor}
                            onChange={e => handleDoorMaterialChange('colour', e.target.value)}
                            className="w-16 h-12 border border-gray-300 rounded-md cursor-pointer"
                          />
                          <input
                            type="text"
                            value={doorColor}
                            onChange={e => handleDoorMaterialChange('colour', e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="#ffffff"
                          />
                        </div>
                      </div>
                    )}

                    {doorEnabled && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Door Thickness (mm)</label>
                        <select
                          value={doorThickness}
                          onChange={e => handleDoorMaterialChange('thickness', Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {doorMaterials.map(m => (
                            <option key={m.id} value={m.thickness}>{m.name} ({m.thickness}mm)</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {isDrawerCabinet() && (
                <div className="bg-white rounded-lg p-4 mb-4 shadow-sm border border-gray-200">
                  <div className="flex items-center space-x-2 mb-4">
                    <Ruler size={20} />
                    <h3>Drawer Settings</h3>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={drawerEnabled}
                          onChange={e => handleDrawerToggle(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Enable Drawers</span>
                      </label>
                    </div>

                    {drawerEnabled && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Number of Drawers</label>
                        <select
                          value={drawerQuantity}
                          onChange={e => handleDrawerQuantityChange(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {Array.from({ length: 6 }, (_, i) => i + 1).map(num => (
                            <option key={num} value={num}>{num} Drawer{num > 1 ? 's' : ''}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {drawerEnabled && drawerQuantity > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Drawer Heights (mm)</label>
                        <div className="mb-2 p-2 bg-blue-50 rounded text-xs text-blue-700 border border-blue-200">
                          <div className="flex justify-between items-center">
                            <span><span className="font-medium">Proportional Height:</span> {Math.round((dimensions.height / drawerQuantity) * 10) / 10}mm per drawer</span>
                            <span className="text-blue-600">(Cabinet Height ÷ Drawer Quantity)</span>
                          </div>
                          <div className="mt-1 text-blue-600">
                            <span className="font-medium">Smart Balancing:</span> When you change one drawer height, others automatically adjust to fill remaining space
                          </div>
                        </div>
                        <div className="space-y-2">
                          {Array.from({ length: drawerQuantity }, (_, i) => (
                            <div key={`drawer-${i}-${drawerQuantity}`} className="flex items-center space-x-2">
                              <label className="text-xs text-gray-600 w-16">Drawer {i + 1}:</label>
                              <input
                                type="number"
                                value={drawerHeights[i] !== undefined ? drawerHeights[i] : Math.round((dimensions.height / drawerQuantity) * 10) / 10}
                                onChange={e => {
                                  updateDrawerHeightLocal(i, Number(e.target.value))
                                  setIsEditingDrawerHeights(true)
                                }}
                                onFocus={() => setIsEditingDrawerHeights(true)}
                                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                min="50"
                                max={dimensions.height}
                                step="0.1"
                                onBlur={e => {
                                  const val = Number(e.target.value)
                                  if (!isNaN(val)) {
                                    const rounded = Math.round(val * 10) / 10
                                    handleDrawerHeightChange(i, rounded)
                                  }
                                  setIsEditingDrawerHeights(false)
                                }}
                              />
                              <span className="text-xs text-gray-500">mm</span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-2 p-2 bg-green-50 rounded text-xs text-green-700 border border-green-200">
                          <div className="flex justify-between items-center">
                            <span><span className="font-medium">Height Balance:</span> {Math.round((dimensions.height - drawerHeights.reduce((s, h) => s + (h || 0), 0)) * 10) / 10}mm remaining</span>
                            <span className="text-green-600">{drawerHeights.filter(h => h === undefined || h === 0).length} drawer(s) to balance</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <div className="flex-1">
                            <p className={`text-xs ${Math.round(drawerHeights.reduce((s, h) => s + (h || 0), 0) * 10) / 10 > dimensions.height ? 'text-red-500 font-medium' : Math.round(drawerHeights.reduce((s, h) => s + (h || 0), 0) * 10) / 10 === dimensions.height ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                              Total: {Math.round(drawerHeights.reduce((s, h) => s + (h || 0), 0) * 10) / 10}mm / {dimensions.height}mm
                              {Math.round(drawerHeights.reduce((s, h) => s + (h || 0), 0) * 10) / 10 > dimensions.height && (
                                <span className="block">⚠️ Total exceeds carcass height</span>
                              )}
                              {Math.round(drawerHeights.reduce((s, h) => s + (h || 0), 0) * 10) / 10 === dimensions.height && (
                                <span className="block">✅ Heights are optimal</span>
                              )}
                            </p>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                              <div
                                className={`h-2 rounded-full transition-all duration-300 ${Math.round(drawerHeights.reduce((s, h) => s + (h || 0), 0) * 10) / 10 > dimensions.height ? 'bg-red-500' : Math.round(drawerHeights.reduce((s, h) => s + (h || 0), 0) * 10) / 10 === dimensions.height ? 'bg-green-500' : 'bg-blue-500'}`}
                                style={{ width: `${Math.min(100, (drawerHeights.reduce((s, h) => s + (h || 0), 0) / dimensions.height) * 100)}%` }}
                              />
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            {Math.round(drawerHeights.reduce((s, h) => s + (h || 0), 0) * 10) / 10 > dimensions.height && (
                              <button onClick={() => { handlers.onDrawerHeightsBalance?.(); recalculateDrawerHeights() }} className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">Balance Heights</button>
                            )}
                            <button onClick={() => { handlers.onDrawerHeightsReset?.(); recalculateDrawerHeights() }} className="text-xs px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">Reset to Optimal</button>
                            <DebugBalanceButton onClick={() => debugBalanceTest?.()} />
                          </div>
                        </div>

                        <div className="mt-3 p-2 bg-gray-50 rounded text-xs">
                          <p className="font-medium text-gray-700 mb-1">Height Distribution:</p>
                          <div className="grid grid-cols-2 gap-1">
                            {drawerHeights.map((h, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span className="text-gray-600">Drawer {idx + 1}:</span>
                                <span className="font-mono">{h || 0}mm</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Used:</span>
                              <span className="font-mono">{Math.round(drawerHeights.reduce((s, h) => s + (h || 0), 0) * 10) / 10}mm</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Available:</span>
                              <span className="font-mono">{Math.round((dimensions.height - drawerHeights.reduce((s, h) => s + (h || 0), 0)) * 10) / 10}mm</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <Settings size={48} className="mx-auto mb-4 text-gray-300" />
              <p>Right-click on a cabinet to edit its properties</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProductPanelView
