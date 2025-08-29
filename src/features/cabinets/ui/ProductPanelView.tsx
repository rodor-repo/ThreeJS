import React, { useMemo } from 'react'
import _ from 'lodash'
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

// ----- Small presentation helpers to reduce JSX noise -----
type SectionProps = { title: string, icon?: React.ReactNode, className?: string, children: React.ReactNode }
const Section = React.memo(({ title, icon, className, children }: SectionProps) => (
  <div className={className ?? 'space-y-1'}>
    <div className="flex items-center space-x-2 text-gray-700 font-medium">
      {icon}
      <h3>{title}</h3>
    </div>
    {children}
  </div>
))
Section.displayName = 'Section'

type DimensionControlProps = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  onFocusEdit?: () => void
  onBlurEdit?: () => void
}
const DimensionControl = React.memo(({ label, value, min, max, step = 10, onChange, onFocusEdit, onBlurEdit }: DimensionControlProps) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">{label} (mm)</label>
    <div className="text-center mb-3">
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        onFocus={() => onFocusEdit?.()}
        onBlur={() => setTimeout(() => onBlurEdit?.(), 100)}
        className="text-center text-lg font-semibold text-blue-600 bg-transparent border-b-2 border-blue-300 focus:border-blue-500 focus:outline-none px-2 py-1 w-24"
        min={min}
        max={max}
        step={step}
      />
      <span className="text-lg font-semibold text-blue-600 ml-1">mm</span>
    </div>
    <div className="flex items-center space-x-3">
      <span className="text-xs text-gray-500 w-12">{min}</span>
      <input
        type="range"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        onMouseDown={e => { e.stopPropagation(); onFocusEdit?.() }}
        onMouseUp={e => { e.stopPropagation(); setTimeout(() => onBlurEdit?.(), 100) }}
        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        min={min}
        max={max}
        step={step}
      />
      <span className="text-xs text-gray-500 w-12">{max}</span>
    </div>
  </div>
))
DimensionControl.displayName = 'DimensionControl'

type ToggleFieldProps = { label: string, checked: boolean, onChange: (v: boolean) => void }
const ToggleField = React.memo(({ label, checked, onChange }: ToggleFieldProps) => (
  <label className="flex items-center space-x-2 cursor-pointer">
    <input
      type="checkbox"
      checked={checked}
      onChange={e => onChange(e.target.checked)}
      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
    />
    <span className="text-sm font-medium text-gray-700">{label}</span>
  </label>
))
ToggleField.displayName = 'ToggleField'

type ColorInputProps = { label: string, value: string, onChange: (v: string) => void, swatchClassName?: string }
const ColorInput = React.memo(({ label, value, onChange, swatchClassName }: ColorInputProps) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <div className="flex items-center space-x-2">
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={swatchClassName ?? 'w-12 h-10 border border-gray-300 rounded-md cursor-pointer'}
      />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder="#ffffff"
      />
    </div>
  </div>
))
ColorInput.displayName = 'ColorInput'

type SelectFieldProps = {
  label: string
  value: number
  onChange: (v: number) => void
  disabled?: boolean
  options: Array<{ value: number, label: string }>
}
const SelectField = React.memo(({ label, value, onChange, disabled, options }: SelectFieldProps) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <select
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      disabled={disabled}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
))
SelectField.displayName = 'SelectField'

type DrawerHeightRowProps = {
  index: number
  value: number | undefined
  proportional: number
  min: number
  max: number
  step?: number
  onChange: (n: number) => void
  onBlurCommit: (n: number) => void
  onFocus?: () => void
}
const DrawerHeightRow = React.memo(({ index, value, proportional, min, max, step = 0.1, onChange, onBlurCommit, onFocus }: DrawerHeightRowProps) => (
  <div className="flex items-center space-x-2">
    <label className="text-xs text-gray-600 w-16">Drawer {index + 1}:</label>
    <input
      type="number"
      value={value !== undefined ? value : proportional}
      onChange={e => onChange(Number(e.target.value))}
      onFocus={onFocus}
      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
      min={min}
      max={max}
      step={step}
      onBlur={e => {
        const val = Number(e.target.value)
        if (!isNaN(val)) onBlurCommit(Math.round(val * 10) / 10)
      }}
    />
    <span className="text-xs text-gray-500">mm</span>
  </div>
))
DrawerHeightRow.displayName = 'DrawerHeightRow'

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

  // ----- Derived calculations (memoized) -----
  const round1 = (n: number) => Math.round(n * 10) / 10
  const proportionalDrawerHeight = useMemo(() => drawerQuantity > 0 ? round1(dimensions.height / drawerQuantity) : 0, [dimensions.height, drawerQuantity])
  const totalDrawerUsed = useMemo(() => round1(_.sum(drawerHeights.map(h => h || 0))), [drawerHeights])
  const remainingDrawerHeight = useMemo(() => round1(dimensions.height - _.sum(drawerHeights.map(h => h || 0))), [dimensions.height, drawerHeights])
  const usedPercent = useMemo(() => Math.min(100, (totalDrawerUsed / dimensions.height) * 100), [totalDrawerUsed, dimensions.height])
  const totalVsColor = totalDrawerUsed > dimensions.height ? 'text-red-500 font-medium' : totalDrawerUsed === dimensions.height ? 'text-green-600 font-medium' : 'text-gray-500'
  const barColor = totalDrawerUsed > dimensions.height ? 'bg-red-500' : totalDrawerUsed === dimensions.height ? 'bg-green-500' : 'bg-blue-500'
  const cabinetTitle = useMemo(() => selectedCabinet ? `${selectedCabinet.cabinetType.charAt(0).toUpperCase()}${selectedCabinet.cabinetType.slice(1)} Cabinet` : '', [selectedCabinet])

  // UI constants
  const DOOR_GAP_VALUE = 2
  const DOOR_GAP_MIN = 1
  const DOOR_GAP_MAX = 5
  const DOOR_GAP_STEP = 0.5
  const KICKER_MIN = 50
  const KICKER_MAX = 200
  const KICKER_STEP = 5

  // Event utility to avoid repeated inline lambdas just for stopPropagation
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  return (
    <div
      className="fixed right-0 top-0 h-full bg-white shadow-lg border-l border-gray-200 transition-all duration-300 ease-in-out z-50 product-panel"
      data-product-panel="true"
      onClick={stop}
      onMouseDown={stop}
      onMouseUp={stop}
      onWheel={stop}
    >
      <button
        onClick={e => { e.stopPropagation(); setIsExpanded(!isExpanded) }}
        onMouseDown={e => e.stopPropagation()}
        onMouseUp={e => e.stopPropagation()}
        className="absolute -left-3 top-1/2 transform -translate-y-1/2 bg-blue-600 text-white rounded-full p-1 hover:bg-blue-700 transition-colors"
      >
        {isExpanded ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <div className={`h-full transition-all duration-300 ease-in-out ${isExpanded ? 'w-80 sm:w-80 max-w-[90vw]' : 'w-0'} overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100`}>
        <div className="bg-gray-50 px-2 sm:px-4 py-2 sm:py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Product Panel</h2>
            <button onClick={e => { e.stopPropagation(); onClose() }} className="text-gray-500 hover:text-gray-700 transition-colors">×</button>
          </div>
          {selectedCabinet && (
            <p className="text-sm text-gray-600 mt-1">
              {cabinetTitle}
            </p>
          )}
        </div>

        <div className="p-2 sm:p-4 space-y-1 min-h-full">
          {selectedCabinet ? (
            <>
              <div className="space-y-4">
                <Section title="Dimensions" icon={<Ruler size={20} />}>
                  <div className="space-y-4">
                    <DimensionControl
                      label="Height"
                      value={dimensions.height}
                      min={dimensionConstraints.height.min}
                      max={dimensionConstraints.height.max}
                      onChange={v => handleDimensionChange('height', v)}
                      onFocusEdit={() => setIsEditingDimensions?.(true)}
                      onBlurEdit={() => setIsEditingDimensions?.(false)}
                    />
                    <DimensionControl
                      label="Width"
                      value={dimensions.width}
                      min={dimensionConstraints.width.min}
                      max={dimensionConstraints.width.max}
                      onChange={v => handleDimensionChange('width', v)}
                      onFocusEdit={() => setIsEditingDimensions?.(true)}
                      onBlurEdit={() => setIsEditingDimensions?.(false)}
                    />
                    <DimensionControl
                      label="Depth"
                      value={dimensions.depth}
                      min={dimensionConstraints.depth.min}
                      max={dimensionConstraints.depth.max}
                      onChange={v => handleDimensionChange('depth', v)}
                      onFocusEdit={() => setIsEditingDimensions?.(true)}
                      onBlurEdit={() => setIsEditingDimensions?.(false)}
                    />
                  </div>
                </Section>
              </div>

              {(selectedCabinet?.cabinetType === 'base' || selectedCabinet?.cabinetType === 'tall') && (
                <Section title="Kicker" icon={<Ruler size={20} />}>
                  <DimensionControl
                    label="Kicker Height"
                    value={kickerHeight}
                    min={KICKER_MIN}
                    max={KICKER_MAX}
                    step={KICKER_STEP}
                    onChange={v => handleKickerHeightChange(v)}
                  />
                  <p className="text-xs text-gray-500 mt-1">Controls the height of cabinet legs (Base and Tall cabinets only)</p>
                </Section>
              )}

              <Section title="Material Properties" icon={<Palette size={20} />}>
                <div className="space-y-3">
                  <ColorInput label="Carcass Colour" value={materialColor} onChange={v => handleMaterialChange('colour', v)} />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Carcass Thickness</label>
                    <input
                      type="number"
                      value={materialThickness}
                      onChange={e => handleMaterialChange('panelThickness', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min={6}
                      max={50}
                      step={1}
                    />
                    <p className="text-xs text-gray-500 mt-1">This will update both panel and back panel thickness</p>
                  </div>
                </div>
              </Section>

              {!isDrawerCabinet() && (
                <Section title="Door Settings" icon={<DoorOpen size={20} />}>
                  <div className="space-y-3">
                    <ToggleField label="Enable Doors" checked={doorEnabled} onChange={handleDoorToggle} />

                    {doorEnabled && selectedCabinet?.cabinetType === 'top' && (
                      <div>
                        <ToggleField label="Overhang Door" checked={overhangDoor} onChange={handleOverhangDoorToggle} />
                        <p className="text-xs text-gray-500 mt-1 ml-6">Makes door 20mm longer and positions it 20mm lower (Top/Wall cabinets only)</p>
                      </div>
                    )}

                    {doorEnabled && (
                      <div>
                        <SelectField
                          label="Number of Doors"
                          value={doorCount}
                          onChange={handleDoorCountChange}
                          disabled={!isOneDoorAllowed()}
                          options={[
                            { value: 1, label: '1 Door' },
                            { value: 2, label: '2 Doors' }
                          ]}
                        />
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
                            value={DOOR_GAP_VALUE}
                            disabled
                            className="text-center text-lg font-semibold text-gray-400 bg-gray-100 border-b-2 border-gray-300 px-2 py-1 w-24 cursor-not-allowed"
                            min={DOOR_GAP_MIN}
                            max={DOOR_GAP_MAX}
                            step={DOOR_GAP_STEP}
                          />
                          <span className="text-lg font-semibold text-gray-400 ml-1">mm</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Gap between doors and carcass edges (read-only)</p>
                      </div>
                    )}

                    {doorEnabled && (
                      <ColorInput
                        label="Door Colour"
                        value={doorColor}
                        onChange={v => handleDoorMaterialChange('colour', v)}
                        swatchClassName="w-16 h-12 border border-gray-300 rounded-md cursor-pointer"
                      />
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
                </Section>
              )}

              {isDrawerCabinet() && (
                <div className="bg-white rounded-lg p-4 mb-4 shadow-sm border border-gray-200">
                  <div className="flex items-center space-x-2 mb-4">
                    <Ruler size={20} />
                    <h3>Drawer Settings</h3>
                  </div>

                  <div className="space-y-3">
                    <ToggleField label="Enable Drawers" checked={drawerEnabled} onChange={handleDrawerToggle} />

                    {drawerEnabled && (
                      <SelectField
                        label="Number of Drawers"
                        value={drawerQuantity}
                        onChange={handleDrawerQuantityChange}
                        options={Array.from({ length: 6 }, (_, i) => i + 1).map(num => ({ value: num, label: `${num} Drawer${num > 1 ? 's' : ''}` }))}
                      />
                    )}

                    {drawerEnabled && drawerQuantity > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Drawer Heights (mm)</label>
                        <div className="mb-2 p-2 bg-blue-50 rounded text-xs text-blue-700 border border-blue-200">
                          <div className="flex justify-between items-center">
                            <span><span className="font-medium">Proportional Height:</span> {proportionalDrawerHeight}mm per drawer</span>
                            <span className="text-blue-600">(Cabinet Height ÷ Drawer Quantity)</span>
                          </div>
                          <div className="mt-1 text-blue-600">
                            <span className="font-medium">Smart Balancing:</span> When you change one drawer height, others automatically adjust to fill remaining space
                          </div>
                        </div>
                        <div className="space-y-2">
                          {Array.from({ length: drawerQuantity }, (_, i) => (
                            <DrawerHeightRow
                              key={`drawer-${i}-${drawerQuantity}`}
                              index={i}
                              value={drawerHeights[i]}
                              proportional={proportionalDrawerHeight}
                              min={50}
                              max={dimensions.height}
                              onChange={v => { updateDrawerHeightLocal(i, v); setIsEditingDrawerHeights(true) }}
                              onFocus={() => setIsEditingDrawerHeights(true)}
                              onBlurCommit={v => { handleDrawerHeightChange(i, v); setIsEditingDrawerHeights(false) }}
                            />
                          ))}
                        </div>

                        <div className="mt-2 p-2 bg-green-50 rounded text-xs text-green-700 border border-green-200">
                          <div className="flex justify-between items-center">
                            <span><span className="font-medium">Height Balance:</span> {remainingDrawerHeight}mm remaining</span>
                            <span className="text-green-600">{drawerHeights.filter(h => h === undefined || h === 0).length} drawer(s) to balance</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <div className="flex-1">
                            <p className={`text-xs ${totalVsColor}`}>
                              Total: {totalDrawerUsed}mm / {dimensions.height}mm
                              {totalDrawerUsed > dimensions.height && (
                                <span className="block">⚠️ Total exceeds carcass height</span>
                              )}
                              {totalDrawerUsed === dimensions.height && (
                                <span className="block">✅ Heights are optimal</span>
                              )}
                            </p>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                              <div className={`h-2 rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${usedPercent}%` }} />
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            {totalDrawerUsed > dimensions.height && (
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
                              <span className="font-mono">{totalDrawerUsed}mm</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Available:</span>
                              <span className="font-mono">{remainingDrawerHeight}mm</span>
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
