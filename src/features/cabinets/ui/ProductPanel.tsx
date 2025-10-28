import { calculateWsProductPrice, type CalculatePriceRequest } from '@/server/calculateWsProductPrice'
import { getProductData, type DefaultMaterialSelections, type MaterialOptionsResponse } from '@/server/getProductData'
import { GDThreeJsType } from '@/types/erpTypes'
import { useQuery } from '@tanstack/react-query'
import _ from 'lodash'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { ProductPanelProps } from './productPanel.types'

interface LocalProductPanelProps extends ProductPanelProps { }

// In-memory per-cabinet state store to persist last user-edited values across panel reopens
type PersistedPanelState = {
  values: Record<string, number | string>
  materialColor: string
  materialSelections?: Record<string, { priceRangeId: string, colorId: string, finishId?: string }>
  price?: { amount: number }
}
const cabinetPanelState = new Map<string, PersistedPanelState>()

const ProductPanel: React.FC<LocalProductPanelProps> = props => {
  // Always render dynamic panel: fetch WsProduct on demand via React Query using cabinet productId
  return <DynamicPanelWithQuery {...props} />
}

export default ProductPanel

// -------- Fetcher wrapper + Dynamic Dims-only variant driven by WsProduct --------
const DynamicPanelWithQuery: React.FC<LocalProductPanelProps> = ({ isVisible, onClose, selectedCabinet, onDimensionsChange, onMaterialChange, onOverhangDoorToggle }) => {
  const productId = selectedCabinet?.productId
  const { data, isLoading, isError } = useQuery({
    queryKey: ['productData', productId],
    queryFn: async () => {
      if (!productId) throw new Error('No productId')
      // Call Next.js Server Action directly for type-safe data
      return await getProductData(productId)
    },
    enabled: !!productId && !!isVisible,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000
  })

  const wsProduct = data?.product
  const materialOptions = data?.materialOptions
  const defaultMaterialSelections = data?.defaultMaterialSelections
  const threeJsGDs = data?.threeJsGDs

  // Debug: log fetched data shape when visible
  useEffect(() => {
    if (!isVisible) return
    if (!productId) return
    console.groupCollapsed('[ProductPanel] Fetched data')
    console.log('productId', productId)
    console.log('product name', wsProduct?.product)
    console.log('materials', wsProduct ? Object.keys(wsProduct.materials || {}) : 'n/a')
    console.log('materialOptions keys', materialOptions ? Object.keys(materialOptions) : 'n/a')
    console.log('defaultMaterialSelections', defaultMaterialSelections)
    console.groupEnd()
  }, [isVisible, productId, wsProduct, materialOptions, defaultMaterialSelections])

  if (!isVisible) return null

  return (
    <DynamicPanel
      isVisible={isVisible}
      onClose={onClose}
      wsProduct={wsProduct}
      materialOptions={materialOptions}
      threeJsGDs={threeJsGDs}
      defaultMaterialSelections={defaultMaterialSelections}
      selectedCabinet={selectedCabinet}
      onDimensionsChange={onDimensionsChange}
      onOverhangDoorToggle={onOverhangDoorToggle}
      onMaterialChange={onMaterialChange}
      loading={isLoading}
      error={isError}
    />
  )
}

type DynamicPanelProps = LocalProductPanelProps & { loading?: boolean, error?: boolean, materialOptions?: MaterialOptionsResponse, defaultMaterialSelections?: DefaultMaterialSelections, threeJsGDs: Record<GDThreeJsType, string[]> | undefined }

const DynamicPanel: React.FC<DynamicPanelProps> = ({ isVisible, onClose, wsProduct, materialOptions, defaultMaterialSelections, selectedCabinet, onDimensionsChange, onMaterialChange, loading, error, threeJsGDs, onOverhangDoorToggle }) => {


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
  // debounced inputs for price calculation
  type MaterialSel = { priceRangeId: string, colorId: string, finishId?: string }
  type PriceInputs = { dims: Record<string, number | string>, materialSelections: Record<string, MaterialSel> }
  const [debouncedInputs, setDebouncedInputs] = useState<PriceInputs>({ dims: {}, materialSelections: {} })
  const lastInitRef = useRef<string | null>(null)
  const cabinetKey = selectedCabinet?.group?.uuid

  useEffect(() => {
    setMaterialColor(selectedCabinet?.material.getColour() || '#ffffff')
  }, [selectedCabinet])


  // const envWidthGDIds = process.env.NEXT_PUBLIC_WIDTH_GDID?.split(',') || []
  // const envHeightGDIds = process.env.NEXT_PUBLIC_HEIGHT_GDID?.split(',') || []
  // const envDepthGDIds = process.env.NEXT_PUBLIC_DEPTH_GDID?.split(',') || []
  const widthGDIds = threeJsGDs?.["width"] || []
  const heightGDIds = threeJsGDs?.["height"] || []
  const depthGDIds = threeJsGDs?.["depth"] || []
  const overhangDoorGDIds = threeJsGDs?.["doorOverhang"] || []

  const dimsList = useMemo(() => {
    const entries = Object.entries(wsProduct?.dims || {})
    const visibleEntries = entries.filter(([, dimObj]) => dimObj.visible !== false)
    return _.sortBy(visibleEntries, ([, dimObj]) => Number(dimObj.sortNum))
  }, [wsProduct?.dims])

  // Initialize values once data loads or when product changes; also apply primary dims to 3D once
  useEffect(() => {
    if (!wsProduct?.dims || !cabinetKey) return
    if (lastInitRef.current === cabinetKey && !_.isEmpty(values)) return
    console.groupCollapsed('[ProductPanel] Initialize')
    console.log('cabinetKey', cabinetKey)
    const entries = Object.entries(wsProduct.dims)
    const defaults: Record<string, number | string> = {}
    entries.forEach(([id, dimObj]) => { defaults[id] = dimObj.defaultValue })
    const saved = cabinetPanelState.get(cabinetKey)
    const nextValues = saved?.values ? { ...defaults, ...saved.values } : defaults
    const nextColor = saved?.materialColor ?? (selectedCabinet?.material.getColour() || '#ffffff')

    // Determine initial material selections: prefer saved, else derive from API defaults, else empty
    // Build API defaults map
    const apiDefaults: Record<string, { priceRangeId: string, colorId: string, finishId?: string }> = {}
    if (defaultMaterialSelections && materialOptions) {
      console.groupCollapsed('[ProductPanel] Apply API defaultMaterialSelections')
      for (const [materialId, sel] of Object.entries(defaultMaterialSelections)) {
        const mOpts = materialOptions[materialId]
        if (!mOpts) {
          console.warn('No material options for', materialId)
          continue
        }
        const desiredColorId = sel.colorId || undefined
        // find priceRange containing the colorId
        let priceRangeId: string | undefined
        if (desiredColorId) {
          for (const [prId, pr] of Object.entries(mOpts.priceRanges)) {
            if (desiredColorId in pr.colorOptions) { priceRangeId = prId; break }
          }
        }
        if (!priceRangeId) {
          priceRangeId = Object.keys(mOpts.priceRanges)[0]
          console.log('Fallback priceRangeId for', materialId, '→', priceRangeId)
        }
        const pr = priceRangeId ? mOpts.priceRanges[priceRangeId] : undefined
        let colorId = desiredColorId
        if (!colorId) {
          colorId = pr ? Object.keys(pr.colorOptions)[0] : ''
          console.log('Fallback colorId for', materialId, '→', colorId)
        }
        // finish
        let finishId = sel.finishId || undefined
        if (!finishId && colorId && pr) {
          const finishes = pr.colorOptions[colorId]?.finishes
          if (finishes) finishId = Object.keys(finishes)[0]
        }
        console.log('Default selection', { materialId, priceRangeId, colorId, finishId })
        apiDefaults[materialId] = { priceRangeId: priceRangeId || '', colorId: colorId || '', finishId }
      }
      console.groupEnd()
    }

    // Merge strategy: API defaults provide base, saved selections override where present
    let nextSelections: Record<string, { priceRangeId: string, colorId: string, finishId?: string }>
    if (saved?.materialSelections) {
      const savedEmpty = _.isEmpty(saved.materialSelections)
      if (savedEmpty) console.log('Saved materialSelections empty → seeding with API defaults')
      nextSelections = { ...apiDefaults, ...saved.materialSelections }
    } else {
      nextSelections = { ...apiDefaults }
    }

    setValues(nextValues)
    setMaterialColor(nextColor)
    setMaterialSelections(nextSelections || {})
    console.log('Initialized values', nextValues)
    console.log('Initialized selections', nextSelections)
    // Persist initialized state and sync 3D primary dims
    cabinetPanelState.set(cabinetKey, { values: nextValues, materialColor: nextColor, materialSelections: nextSelections || {}, price: saved?.price })
    console.log('Persisted state for', cabinetKey)
    lastInitRef.current = cabinetKey
    applyPrimaryDimsTo3D(nextValues)
    console.groupEnd()
  }, [wsProduct?.dims, cabinetKey, materialOptions, defaultMaterialSelections])

  // Setup debounced updates for price inputs
  useEffect(() => {
    const updater = _.debounce((next: PriceInputs) => {
      console.log('[ProductPanel] Debounced price inputs', next)
      setDebouncedInputs(next)
    }, 400)
    updater({ dims: values, materialSelections })
    return () => {
      updater.cancel()
    }
  }, [values, materialSelections])

  // Price calculation via React Query keyed by all affecting inputs
  const { data: priceData, isFetching: isPriceFetching, isError: isPriceError } = useQuery({
    queryKey: ['wsProductPrice', wsProduct?.productId, debouncedInputs.dims, debouncedInputs.materialSelections],
    queryFn: async () => {
      if (!wsProduct?.productId) throw new Error('No productId')
      const payload: CalculatePriceRequest = {
        productId: wsProduct.productId,
        dims: debouncedInputs.dims,
        materialSelections: debouncedInputs.materialSelections
      }
      const res = await calculateWsProductPrice(payload)
      return { amount: res.price }
    },
    enabled: !!isVisible && !!wsProduct?.productId && Object.keys(debouncedInputs.dims || {}).length > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  })

  useEffect(() => {
    if (isPriceFetching) return
    if (isPriceError) {
      console.warn('[ProductPanel] Price query error for', wsProduct?.productId)
    } else if (priceData) {
      console.log('[ProductPanel] Price updated', priceData)
    }
  }, [priceData, isPriceFetching, isPriceError, wsProduct?.productId])

  // Persist latest price in the in-memory store for the cabinet
  useEffect(() => {
    if (!cabinetKey) return
    const persisted = cabinetPanelState.get(cabinetKey)
    cabinetPanelState.set(cabinetKey, { ...(persisted || { values, materialColor, materialSelections }), price: priceData || persisted?.price })
  }, [priceData, cabinetKey])


  const applyPrimaryDimsTo3D = (vals: Record<string, number | string>) => {
    if (!selectedCabinet || !onDimensionsChange) return
    const toNum = (v: number | string | undefined) => typeof v === 'number' ? v : Number(v)
    let width = selectedCabinet.dimensions.width
    let height = selectedCabinet.dimensions.height
    let depth = selectedCabinet.dimensions.depth
    let overhangDoor = selectedCabinet.overhangDoor
    dimsList.forEach(([id, dimObj]) => {
      if (!dimObj.GDId) return
      const v = vals[id]
      if (widthGDIds.includes(dimObj.GDId)) width = toNum(v) || width
      if (heightGDIds.includes(dimObj.GDId)) height = toNum(v) || height
      if (depthGDIds.includes(dimObj.GDId)) depth = toNum(v) || depth
      if (overhangDoorGDIds.includes(dimObj.GDId)) overhangDoor = v.toString().toLowerCase() === 'yes' || v === 1 || v === '1'
    })
    onDimensionsChange({ width, height, depth })
    onOverhangDoorToggle?.(overhangDoor || false)
    console.log('[ProductPanel] Applied primary dims to 3D', { width, height, depth })
  }

  // Price is calculated automatically via debounced query

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
            <div className="ml-2 flex items-center gap-2 text-sm text-gray-700">
              {isPriceFetching ? (
                <span className="text-gray-500">Updating…</span>
              ) : isPriceError ? (
                <span className="text-red-600">Price N/A</span>
              ) : priceData ? (
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">{`$${priceData.amount.toFixed(2)}`}</span>
              ) : null}
            </div>
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
                        {dimObj.GDId && widthGDIds.includes(dimObj.GDId) && <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-600">Width</span>}
                        {dimObj.GDId && heightGDIds.includes(dimObj.GDId) && <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-600">Height</span>}
                        {dimObj.GDId && depthGDIds.includes(dimObj.GDId) && <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-600">Depth</span>}
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
                              if (cabinetKey) {
                                const persisted = cabinetPanelState.get(cabinetKey)
                                cabinetPanelState.set(cabinetKey, { ...(persisted || {} as any), values: next, materialColor, materialSelections, price: priceData || persisted?.price })
                              }
                              console.log('[ProductPanel] Number dim changed', { id, dim: dimObj.dim, val })
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
                            if (cabinetKey) {
                              const persisted = cabinetPanelState.get(cabinetKey)
                              cabinetPanelState.set(cabinetKey, { ...(persisted || {} as any), values: next, materialColor, materialSelections, price: priceData || persisted?.price })
                            }
                            console.log('[ProductPanel] Range dim changed', { id, dim: dimObj.dim, val })
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
                          if (cabinetKey) {
                            const persisted = cabinetPanelState.get(cabinetKey)
                            cabinetPanelState.set(cabinetKey, { ...(persisted || {} as any), values: next, materialColor, materialSelections, price: priceData || persisted?.price })
                          }
                          console.log('[ProductPanel] Select dim changed', { id, dim: dimObj.dim, val })
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
                                      console.log('[ProductPanel] Main list price range changed', { materialId, priceRangeId, firstColorId, firstFinishId })
                                      if (cabinetKey) {
                                        const persisted = cabinetPanelState.get(cabinetKey)
                                        cabinetPanelState.set(cabinetKey, { ...(persisted || {} as any), values, materialColor, materialSelections: next, price: priceData || persisted?.price })
                                      }
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
                                onClick={() => { setOpenMaterialId(materialId); console.log('[ProductPanel] Open color modal', { materialId }) }}
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
                    if (cabinetKey) {
                      const persisted = cabinetPanelState.get(cabinetKey)
                      cabinetPanelState.set(cabinetKey, { ...(persisted || {} as any), values, materialColor: color, materialSelections, price: priceData || persisted?.price })
                    }
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
                    if (cabinetKey) {
                      const persisted = cabinetPanelState.get(cabinetKey)
                      cabinetPanelState.set(cabinetKey, { ...(persisted || {} as any), values, materialColor: color, materialSelections, price: priceData || persisted?.price })
                    }
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
                  console.log('Price:', priceData)
                }}
                className="w-full text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Log selections
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Secondary side panel for Color Select (left of main ProductPanel) */}
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
          setMaterialSelections(next)
          console.log('[ProductPanel] Modal commit', { materialId: openMaterialId, selection: next[openMaterialId] })
          if (cabinetKey) {
            const persisted = cabinetPanelState.get(cabinetKey)
            cabinetPanelState.set(cabinetKey, { ...(persisted || {} as any), values, materialColor, materialSelections: next, price: priceData || persisted?.price })
          }
          setOpenMaterialId(null)
        }

        return (
          <div
            className={`fixed top-0 h-full bg-white shadow-lg border-r border-gray-200 transition-all duration-300 ease-in-out z-[55] ${isExpanded ? 'right-80 sm:right-96' : 'right-0'} w-80 sm:w-96`}
            data-color-panel
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            onMouseUp={e => e.stopPropagation()}
            onWheel={e => e.stopPropagation()}
          >
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <div className="text-base font-medium truncate">Select color – {m.material}</div>
                <div className="ml-2 text-sm flex items-center gap-2">
                  {isPriceFetching ? (
                    <span className="text-gray-500">Updating…</span>
                  ) : isPriceError ? (
                    <span className="px-2 py-0.5 rounded bg-red-50 text-red-700">Price N/A</span>
                  ) : priceData ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">${priceData.amount.toFixed(2)}</span>
                  ) : null}
                </div>
                <button className="text-gray-500 hover:text-gray-700" onClick={() => commit()}>×</button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4">
                {/* Price range select */}
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
                      console.log('[ProductPanel] Color panel price range changed', { materialId: openMaterialId, priceRangeId: prId, firstColor, firstFinish })
                      if (cabinetKey) {
                        const persisted = cabinetPanelState.get(cabinetKey)
                        cabinetPanelState.set(cabinetKey, { ...(persisted || {} as any), values, materialColor, materialSelections: next, price: priceData || persisted?.price })
                      }
                    }}
                  >
                    {prPairs.map(([prId, pr]) => (
                      <option key={prId} value={prId}>{pr.priceRange}</option>
                    ))}
                  </select>
                </div>

                {/* 2-column color grid */}
                <div className="grid grid-cols-2 gap-4">
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
                          console.log('[ProductPanel] Color panel color picked', { materialId: openMaterialId, colorId: cId, finishId: nextFinishId || undefined })
                          if (cabinetKey) {
                            const persisted = cabinetPanelState.get(cabinetKey)
                            cabinetPanelState.set(cabinetKey, { ...(persisted || {} as any), values, materialColor, materialSelections: next, price: priceData || persisted?.price })
                          }
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            const nextFinishId = Object.keys(c.finishes)[0] || ''
                            const next = { ...materialSelections, [openMaterialId]: { priceRangeId: priceRangeId || '', colorId: cId, finishId: nextFinishId || undefined } }
                            setMaterialSelections(next)
                            console.log('[ProductPanel] Color panel color picked via keyboard', { materialId: openMaterialId, colorId: cId, finishId: nextFinishId || undefined })
                            if (cabinetKey) {
                              const persisted = cabinetPanelState.get(cabinetKey)
                              cabinetPanelState.set(cabinetKey, { ...(persisted || {} as any), values, materialColor, materialSelections: next, price: priceData || persisted?.price })
                            }
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
                                    console.log('[ProductPanel] Color panel finish picked', { materialId: openMaterialId, colorId: cId, finishId: fId })
                                    if (cabinetKey) {
                                      const persisted = cabinetPanelState.get(cabinetKey)
                                      cabinetPanelState.set(cabinetKey, { ...(persisted || {} as any), values, materialColor, materialSelections: next, price: priceData || persisted?.price })
                                    }
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

              {/* Footer */}
              <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-end">
                <button className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={() => commit()}>Close</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
