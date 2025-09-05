import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { CarcassDimensions, CarcassMaterial, CarcassMaterialData, DoorMaterial, DoorMaterialData } from '@/features/carcass'
import { useProductPanelState } from '../../cabinets/hooks/useProductPanelState'
import ProductPanelView from './ProductPanelView'
import type { ProductPanelProps } from './productPanel.types'
import _ from 'lodash'
import { useQuery } from '@tanstack/react-query'
import { getWsProduct, type MaterialOptionsResponse } from '@/server/getWsProduct'

interface LocalProductPanelProps extends ProductPanelProps { }

// In-memory per-cabinet state store to persist last user-edited values across panel reopens
type PersistedPanelState = {
  values: Record<string, number | string>
  materialColor: string
  materialSelections?: Record<string, { priceRangeId: string, colorId: string, finishId?: string }>
}
const cabinetPanelState = new Map<string, PersistedPanelState>()

const ProductPanel: React.FC<LocalProductPanelProps> = props => {
  // Always render dynamic panel: fetch WsProduct on demand via React Query using cabinet productId
  return <DynamicPanelWithQuery {...props} />
}

export default ProductPanel

// -------- Fetcher wrapper + Dynamic Dims-only variant driven by WsProduct --------
const DynamicPanelWithQuery: React.FC<LocalProductPanelProps> = ({ isVisible, onClose, selectedCabinet, onDimensionsChange, onMaterialChange }) => {
  const productId = selectedCabinet?.productId
  const { data, isLoading, isError } = useQuery({
    queryKey: ['wsProduct', productId],
    queryFn: async () => {
      if (!productId) throw new Error('No productId')
      // Call Next.js Server Action directly for type-safe data
      return await getWsProduct(productId)
    },
    enabled: !!productId && !!isVisible,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000
  })

  const wsProduct = data?.product
  const materialOptions = data?.materialOptions

  if (!isVisible) return null

  return (
    <DynamicPanel
      isVisible={isVisible}
      onClose={onClose}
      wsProduct={wsProduct}
      materialOptions={materialOptions}
      selectedCabinet={selectedCabinet}
      onDimensionsChange={onDimensionsChange}
      onMaterialChange={onMaterialChange}
      loading={isLoading}
      error={isError}
    />
  )
}

type DynamicPanelProps = LocalProductPanelProps & { loading?: boolean, error?: boolean, materialOptions?: MaterialOptionsResponse }

const DynamicPanel: React.FC<DynamicPanelProps> = ({ isVisible, onClose, wsProduct, materialOptions, selectedCabinet, onDimensionsChange, onMaterialChange, loading, error }) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const [values, setValues] = useState<Record<string, number | string>>(() => {
    const entries = Object.entries(wsProduct?.dims || {})
    const initial: Record<string, number | string> = {}
    entries.forEach(([id, dimObj]) => { initial[id] = dimObj.defaultValue })
    return initial
  })
  const [materialColor, setMaterialColor] = useState<string>(selectedCabinet?.material.getColour() || '#ffffff')
  const [materialSelections, setMaterialSelections] = useState<Record<string, { priceRangeId: string, colorId: string, finishId?: string }>>({})
  const [openMaterialId, setOpenMaterialId] = useState<string | null>(null)
  const lastInitRef = useRef<string | null>(null)
  const cabinetKey = selectedCabinet?.group?.uuid

  useEffect(() => {
    setMaterialColor(selectedCabinet?.material.getColour() || '#ffffff')
  }, [selectedCabinet])


  const envWidthGDId = process.env.NEXT_PUBLIC_WIDTH_GDID
  const envHeightGDId = process.env.NEXT_PUBLIC_HEIGHT_GDID
  const envDepthGDId = process.env.NEXT_PUBLIC_DEPTH_GDID

  const dimsList = useMemo(() => {
    const entries = Object.entries(wsProduct?.dims || {})
    const visibleEntries = entries.filter(([, dimObj]) => dimObj.visible !== false)
    return _.sortBy(visibleEntries, ([, dimObj]) => Number(dimObj.sortNum))
  }, [wsProduct?.dims])

  // Initialize values once data loads or when product changes; also apply primary dims to 3D once
  useEffect(() => {
    if (!wsProduct?.dims || !cabinetKey) return
    if (lastInitRef.current === cabinetKey && !_.isEmpty(values)) return
    const entries = Object.entries(wsProduct.dims)
    const defaults: Record<string, number | string> = {}
    entries.forEach(([id, dimObj]) => { defaults[id] = dimObj.defaultValue })
    const saved = cabinetPanelState.get(cabinetKey)
    const nextValues = saved?.values ? { ...defaults, ...saved.values } : defaults
    const nextColor = saved?.materialColor ?? (selectedCabinet?.material.getColour() || '#ffffff')
    const nextSelections = saved?.materialSelections ?? {}
    setValues(nextValues)
    setMaterialColor(nextColor)
    setMaterialSelections(nextSelections)
    // Persist initialized state and sync 3D primary dims
    cabinetPanelState.set(cabinetKey, { values: nextValues, materialColor: nextColor, materialSelections: nextSelections })
    lastInitRef.current = cabinetKey
    applyPrimaryDimsTo3D(nextValues)
  }, [wsProduct?.dims, cabinetKey])


  const applyPrimaryDimsTo3D = (vals: Record<string, number | string>) => {
    if (!selectedCabinet || !onDimensionsChange) return
    const toNum = (v: number | string | undefined) => typeof v === 'number' ? v : Number(v)
    let width = selectedCabinet.dimensions.width
    let height = selectedCabinet.dimensions.height
    let depth = selectedCabinet.dimensions.depth
    dimsList.forEach(([id, dimObj]) => {
      if (!dimObj.GDId) return
      const v = vals[id]
      if (dimObj.GDId === envWidthGDId) width = toNum(v) || width
      if (dimObj.GDId === envHeightGDId) height = toNum(v) || height
      if (dimObj.GDId === envDepthGDId) depth = toNum(v) || depth
    })
    onDimensionsChange({ width, height, depth })
  }

  if (!isVisible) return null

  return (
    <div
      className="fixed right-0 top-0 h-full bg-white shadow-lg border-l border-gray-200 transition-all duration-300 ease-in-out z-50 productPanel"
      data-product-panel
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
        {isExpanded ? '<' : '>'}
      </button>

      <div className={`h-full transition-all duration-300 ease-in-out ${isExpanded ? 'w-80 sm:w-96 max-w-[90vw]' : 'w-0'} overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100`}>
        {/* Header */}
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Product Panel</h2>
            <button onClick={e => { e.stopPropagation(); onClose() }} className="text-gray-500 hover:text-gray-700 transition-colors">×</button>
          </div>
          {wsProduct && <p className="text-sm text-gray-600 mt-1 truncate">{wsProduct.product}</p>}
        </div>

        {/* Loading / Error */}
        {loading ? (
          <div className="p-6 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-red-600">Failed to load product</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Dimensions */}
            <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
              <div className="flex items-center space-x-2 mb-2.5 text-gray-700 font-medium">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5" /><path d="M8 21H3v-5" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></svg>
                <h3>Dimensions</h3>
              </div>
              <div className="space-y-3">
                {dimsList.map(([id, dimObj]) => (
                  <div key={id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700">
                        {dimObj.dim}
                      </label>
                      <div className="flex items-center gap-2">
                        {dimObj.GDId === envWidthGDId && <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-600">Width</span>}
                        {dimObj.GDId === envHeightGDId && <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-600">Height</span>}
                        {dimObj.GDId === envDepthGDId && <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-600">Depth</span>}
                      </div>
                    </div>

                    {dimObj.valueType === 'range' ? (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <input
                            type="number"
                            className="w-20 text-center text-sm px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-tight"
                            value={Number(((values[id] ?? dimObj.defaultValue ?? dimObj.min) as any))}
                            min={dimObj.min}
                            max={dimObj.max}
                            onChange={e => {
                              const val = Number(e.target.value)
                              const next = { ...values, [id]: val }
                              setValues(next)
                              applyPrimaryDimsTo3D(next)
                            }}
                          />
                          <span className="text-sm text-gray-500">mm</span>
                        </div>
                        <input
                          type="range"
                          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                          value={Number(((values[id] ?? dimObj.defaultValue ?? dimObj.min) as any))}
                          min={dimObj.min}
                          max={dimObj.max}
                          onChange={e => {
                            const val = Number(e.target.value)
                            const next = { ...values, [id]: val }
                            setValues(next)
                            if (cabinetKey) cabinetPanelState.set(cabinetKey, { values: next, materialColor })
                            if (cabinetKey) cabinetPanelState.set(cabinetKey, { values: next, materialColor })
                            applyPrimaryDimsTo3D(next)
                          }}
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>{dimObj.min}</span>
                          <span>{dimObj.max}</span>
                        </div>
                      </div>
                    ) : (
                      <select
                        className="w-full text-sm px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-tight"
                        value={String(values[id] ?? dimObj.defaultValue ?? (dimObj.options?.[0] ?? ''))}
                        onChange={e => {
                          const val = e.target.value
                          const next = { ...values, [id]: val }
                          setValues(next)
                          if (cabinetKey) cabinetPanelState.set(cabinetKey, { values: next, materialColor })
                          applyPrimaryDimsTo3D(next)
                        }}
                      >
                        {dimObj.options.map(opt => (
                          <option key={String(opt)} value={String(opt)}>{String(opt)}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Materials selection */}
            {wsProduct && (
              <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                <div className="flex items-center space-x-2 mb-2.5 text-gray-700 font-medium">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
                  <h3>Materials</h3>
                </div>
                <div className="space-y-4">
                  {_(wsProduct.materials)
                    .toPairs()
                    .filter(([, m]) => m.visible !== false)
                    .sortBy(([, m]) => Number(m.sortNum))
                    .map(([materialId, m]) => {
                      const mOpts = materialOptions?.[materialId]
                      const prPairs = mOpts ? Object.entries(mOpts.priceRanges) : []
                      const selected = materialSelections[materialId]
                      const selectedPriceRangeId = selected?.priceRangeId || m.priceRangeIds?.[0] || prPairs?.[0]?.[0]
                      const selectedPriceRange = selectedPriceRangeId && mOpts ? mOpts.priceRanges[selectedPriceRangeId] : undefined
                      const colorPairs = selectedPriceRange ? Object.entries(selectedPriceRange.colorOptions) : []
                      const selectedColorId = selected?.colorId || colorPairs?.[0]?.[0]
                      const selectedColor = selectedColorId && selectedPriceRange ? selectedPriceRange.colorOptions[selectedColorId] : undefined
                      const selectedFinishId = selected?.finishId || (selectedColor ? Object.keys(selectedColor.finishes)[0] : undefined)
                      const selectedFinish = selectedFinishId && selectedColor ? selectedColor.finishes[selectedFinishId] : undefined

                      return (
                        <div key={materialId} className="border border-gray-200 rounded-md p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-gray-800 capitalize">{m.material}</div>
                              <div className="mt-2">
                                <label className="block text-xs text-gray-600 mb-1">Price range</label>
                                <select
                                  className="w-full text-sm px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-tight"
                                  value={selectedPriceRangeId || ''}
                                  onChange={e => {
                                    const priceRangeId = e.target.value
                                    setMaterialSelections(prev => {
                                      const next = { ...prev }
                                      const firstColorId = mOpts?.priceRanges?.[priceRangeId] ? Object.keys(mOpts.priceRanges[priceRangeId].colorOptions)[0] : undefined
                                      const firstFinishId = firstColorId && mOpts?.priceRanges?.[priceRangeId]?.colorOptions?.[firstColorId] ? Object.keys(mOpts.priceRanges[priceRangeId].colorOptions[firstColorId].finishes)[0] : undefined
                                      next[materialId] = { priceRangeId, colorId: firstColorId || '', finishId: firstFinishId }
                                      if (cabinetKey) cabinetPanelState.set(cabinetKey, { values, materialColor, materialSelections: next })
                                      return next
                                    })
                                  }}
                                >
                                  {prPairs.map(([prId, pr]) => (
                                    <option key={prId} value={prId}>{pr.priceRange}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="min-w-[140px] text-right">
                              <button
                                className="inline-flex items-center gap-2 text-sm px-3 py-1.5 bg-gray-800 text-white rounded hover:bg-gray-900 disabled:opacity-50"
                                disabled={!mOpts || prPairs.length === 0}
                                onClick={() => setOpenMaterialId(materialId)}
                              >
                                <span>Select Colour</span>
                              </button>
                              <div className="mt-2 text-xs text-gray-600 truncate">
                                {selectedColor ? (
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-6 h-6 rounded bg-gray-100 overflow-hidden border border-gray-200">
                                      {selectedColor.imageUrl ? (
                                        <img src={selectedColor.imageUrl} alt={selectedColor.color} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full bg-gray-200" />
                                      )}
                                    </div>
                                    <div className="max-w-[120px] text-right">
                                      <div className="text-gray-800">{selectedColor.color}</div>
                                      {selectedFinish && <div className="text-gray-500">{selectedFinish.finish}</div>}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-gray-500">No color selected</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                    .value()}
                </div>
              </div>
            )}

            {/* Material color selection (simple) */}
            <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
              <div className="flex items-center space-x-2 mb-2.5 text-gray-700 font-medium">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M14.31 8l5.74 9.94" /><path d="M9.69 8h11.48" /><path d="M7.38 12l5.74-9.94" /><path d="M9.69 16L3.95 6.06" /><path d="M14.31 16H2.83" /></svg>
                <h3>Material</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  className="w-10 h-8 border border-gray-300 rounded-md cursor-pointer"
                  value={materialColor}
                  onChange={e => {
                    const color = e.target.value
                    setMaterialColor(color)
                    onMaterialChange?.({ colour: color })
                    if (cabinetKey) cabinetPanelState.set(cabinetKey, { values, materialColor: color, materialSelections })
                  }}
                />
                <input
                  type="text"
                  className="flex-1 text-sm px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-tight"
                  value={materialColor}
                  onChange={e => {
                    const color = e.target.value
                    setMaterialColor(color)
                    onMaterialChange?.({ colour: color })
                    if (cabinetKey) cabinetPanelState.set(cabinetKey, { values, materialColor: color, materialSelections })
                  }}
                />
              </div>
            </div>

            {/* Bottom actions */}
            <div className="pt-1.5">
              <button
                onClick={() => {
                  console.log('Selected dimensions:', values)
                  console.log('Material color:', materialColor)
                  console.log('Material selections:', materialSelections)
                }}
                className="w-full text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Log selections
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Color Select Modal */}
      {openMaterialId && (() => {
        const m = wsProduct?.materials?.[openMaterialId]
        const mOpts = materialOptions?.[openMaterialId]
        if (!m || !mOpts) return null
        const prPairs = Object.entries(mOpts.priceRanges)
        const sel = materialSelections[openMaterialId]
        const priceRangeId = sel?.priceRangeId || m.priceRangeIds?.[0] || prPairs?.[0]?.[0]
        const priceRange = priceRangeId ? mOpts.priceRanges[priceRangeId] : undefined
        const colorPairs = priceRange ? Object.entries(priceRange.colorOptions) : []
        const colorId = sel?.colorId || colorPairs?.[0]?.[0]
        const selectedColor = colorId && priceRange ? priceRange.colorOptions[colorId] : undefined
        const finishId = sel?.finishId || (selectedColor ? Object.keys(selectedColor.finishes)[0] : undefined)

        const commit = () => {
          const currentSel = materialSelections[openMaterialId]
          const next = {
            ...materialSelections,
            [openMaterialId]: {
              priceRangeId: currentSel?.priceRangeId || priceRangeId || '',
              colorId: currentSel?.colorId || colorId || '',
              finishId: currentSel?.finishId || finishId || undefined
            }
          }
          if (currentSel) setMaterialSelections(next)
          if (cabinetKey) cabinetPanelState.set(cabinetKey, { values, materialColor, materialSelections: next })
          setOpenMaterialId(null)
        }

        return (
          <div className="fixed inset-0 z-[60]">
            <div className="absolute inset-0 bg-black/50" onClick={() => setOpenMaterialId(null)} />
            <div className="absolute inset-0 flex flex-col">
              {/* Top bar like webshop: show price 0 */}
              <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                <div className="text-base font-medium">Select color – {m.material}</div>
                <div className="text-sm"><span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700">Price: $0</span></div>
              </div>
              <div className="flex-1 overflow-y-auto bg-white">
                {/* Grid of color tiles */}
                <div className="max-w-5xl mx-auto px-4 py-4">
                  {/* Price range select duplicated here for convenience */}
                  <div className="flex items-center gap-2 mb-4">
                    <label className="text-sm text-gray-600">Price range</label>
                    <select
                      className="text-sm px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={priceRangeId || ''}
                      onChange={e => {
                        const prId = e.target.value
                        const firstColor = Object.keys(mOpts.priceRanges[prId].colorOptions)[0]
                        const firstFinish = firstColor ? Object.keys(mOpts.priceRanges[prId].colorOptions[firstColor].finishes)[0] : ''
                        const next = { ...materialSelections, [openMaterialId]: { priceRangeId: prId, colorId: firstColor || '', finishId: firstFinish || undefined } }
                        setMaterialSelections(next)
                        if (cabinetKey) cabinetPanelState.set(cabinetKey, { values, materialColor, materialSelections: next })
                      }}
                    >
                      {prPairs.map(([prId, pr]) => (
                        <option key={prId} value={prId}>{pr.priceRange}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {colorPairs.map(([cId, c]) => {
                      const isSelectedColor = cId === (materialSelections[openMaterialId]?.colorId || colorId)
                      const currentSel = materialSelections[openMaterialId]
                      const currentFinishId = currentSel?.finishId
                      return (
                        <div
                          key={cId}
                          role="button"
                          tabIndex={0}
                          className={`group relative rounded-lg overflow-hidden border ${isSelectedColor ? 'border-blue-600 ring-2 ring-blue-200' : 'border-gray-200'} hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-300`}
                          onClick={() => {
                            const nextFinishId = Object.keys(c.finishes)[0] || ''
                            const next = { ...materialSelections, [openMaterialId]: { priceRangeId: priceRangeId || '', colorId: cId, finishId: nextFinishId || undefined } }
                            setMaterialSelections(next)
                            if (cabinetKey) cabinetPanelState.set(cabinetKey, { values, materialColor, materialSelections: next })
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              const nextFinishId = Object.keys(c.finishes)[0] || ''
                              const next = { ...materialSelections, [openMaterialId]: { priceRangeId: priceRangeId || '', colorId: cId, finishId: nextFinishId || undefined } }
                              setMaterialSelections(next)
                              if (cabinetKey) cabinetPanelState.set(cabinetKey, { values, materialColor, materialSelections: next })
                            }
                          }}
                        >
                          <div className="aspect-square w-full bg-gray-100">
                            {c.imageUrl ? (
                              <img src={c.imageUrl} alt={c.color} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gray-200" />
                            )}
                          </div>
                          <div className="p-2 text-left">
                            <div className="text-sm text-gray-800 truncate">{c.color}</div>
                            {/* Finishes under color name */}
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {Object.entries(c.finishes).map(([fId, f]) => {
                                const isSelectedFinish = isSelectedColor && fId === currentFinishId
                                return (
                                  <button
                                    key={fId}
                                    className={`px-2 py-1 rounded border text-xs ${isSelectedFinish ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                                    onClick={e => {
                                      e.stopPropagation()
                                      const next = { ...materialSelections, [openMaterialId]: { priceRangeId: priceRangeId || '', colorId: cId, finishId: fId } }
                                      setMaterialSelections(next)
                                      if (cabinetKey) cabinetPanelState.set(cabinetKey, { values, materialColor, materialSelections: next })
                                    }}
                                  >
                                    {f.finish}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-end gap-2">
                <button className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={() => setOpenMaterialId(null)}>Cancel</button>
                <button className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => commit()}>Use selected</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
