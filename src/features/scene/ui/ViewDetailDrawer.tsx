import React, { useMemo, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { useQueries } from '@tanstack/react-query'
import { getProductData } from '@/server/getProductData'
import { priceQueryKeys } from '@/features/cabinets/ui/productPanel/utils/queryKeys'
import type { WsProducts } from '@/types/erpTypes'
import type { FormulaPiece } from '@/types/formulaTypes'
import type { CabinetData, WallDimensions } from '../types'
import { cabinetPanelState } from '@/features/cabinets/ui/ProductPanel'
import type { ViewId } from '@/features/cabinets/ViewManager'
import { GDFormulaSection } from './GDFormulaSection'
import { KickerHeightSection } from '@/features/cabinets/ui/productPanel/components/KickerHeightSection'

type Props = {
  isOpen: boolean
  onClose: () => void
  viewName: string
  cabinets: CabinetData[]
  wsProducts: WsProducts | null
  viewId: string | null
  splashbackHeight?: number
  wallDimensions?: WallDimensions
  onDimensionChange?: (gdId: string, newValue: number, productDataMap: Map<string, any>) => void
  onSplashbackHeightChange?: (viewId: string, height: number) => void
  onKickerHeightChange?: (viewId: string, height: number) => void
  formulaPieces?: FormulaPiece[]
  getGDFormula?: (viewId: ViewId, gdId: string) => string | undefined
  onGDFormulaChange?: (
    viewId: ViewId,
    gdId: string,
    formula: string | null
  ) => void
  getGDFormulaLastEvaluatedAt?: (
    viewId: ViewId,
    gdId: string
  ) => number | undefined
}

export const ViewDetailDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  viewName,
  cabinets,
  wsProducts,
  viewId,
  wallDimensions,
  onDimensionChange,
  onSplashbackHeightChange,
  onKickerHeightChange,
  formulaPieces,
  getGDFormula,
  onGDFormulaChange,
  getGDFormulaLastEvaluatedAt,
}) => {
  const viewCabinets = useMemo(() => {
    if (!viewId) return []
    return cabinets.filter((cabinet) => cabinet.viewId === viewId)
  }, [cabinets, viewId])
  // Get all unique productIds from cabinets in the view
  const uniqueProductIds = useMemo(() => {
    const productIdSet = new Set<string>()
    viewCabinets.forEach((cabinet) => {
      if (cabinet.productId && !cabinet.productId.startsWith("appliance-")) {
        productIdSet.add(cabinet.productId)
      }
    })
    return Array.from(productIdSet).sort()
  }, [viewCabinets])

  // Memoize queries to keep useQueries stable
  const queries = useMemo(() => uniqueProductIds.map((productId) => ({
    queryKey: priceQueryKeys.productData(productId),
    queryFn: () => getProductData(productId),
    enabled: isOpen && !!productId,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })), [uniqueProductIds, isOpen])

  // Fetch product data for all unique productIds using useQueries
  const productQueries = useQueries({ queries })

  // Collect all unique GDIds from cabinets' product dimensions
  const allGDIds = useMemo(() => {
    const gdIdSet = new Set<string>()
    
    if (!wsProducts) return []
    
    // Iterate through all product queries and extract GDIds
    productQueries.forEach((query) => {
      if (!query.data?.product?.dims) return
      
      // Get all dims from this product
      const dims = query.data.product.dims
      Object.values(dims).forEach((dimObj) => {
        // Only include if GDId exists and dimension is visible
        if (dimObj.GDId && dimObj.visible !== false) {
          gdIdSet.add(dimObj.GDId)
        }
      })
    })
    
    return Array.from(gdIdSet).sort()
  }, [productQueries, wsProducts])

  // For each GDId, find all cabinets that have this dimension and calculate min/max
  const gdListWithSliders = useMemo(() => {
    if (!wsProducts) return []
    
    return allGDIds
      .map((gdId) => {
        const gd = wsProducts.GDs[gdId]
        if (!gd) return null
        
        // Only include if GD is visible
        if (gd.visible === false) return null
        
        // Find all cabinets that have this GDId in their product dimensions
        const cabinetsWithThisGD: Array<{ cabinet: CabinetData; dimId: string; dimObj: any }> = []
        
        productQueries.forEach((query, queryIndex) => {
          if (!query.data?.product?.dims) return
          
          const productId = uniqueProductIds[queryIndex]
          if (!productId) return
          
          // Find cabinets with this productId
          const cabinetsWithProduct = viewCabinets.filter(c => c.productId === productId)
          
          // Find dimensions with this GDId
          const dims = query.data.product.dims
          Object.entries(dims).forEach(([dimId, dimObj]) => {
            if (dimObj.GDId === gdId && dimObj.visible !== false) {
              // Include range dimensions (they have min/max for sliders)
              // Also include selection dimensions (they can have numeric options or string options like "yes"/"no")
              if (dimObj.valueType === 'range' || dimObj.valueType === 'selection') {
                cabinetsWithProduct.forEach(cabinet => {
                  cabinetsWithThisGD.push({ cabinet, dimId, dimObj })
                })
              }
            }
          })
        })
        
        // If no cabinets have this GDId, skip it
        if (cabinetsWithThisGD.length === 0) return null
        
        // Calculate min/max: get all minimums, take the biggest; get all maximums, take the smallest
        const allMins: number[] = []
        const allMaxes: number[] = []
        
        cabinetsWithThisGD.forEach(({ dimObj }) => {
          if (dimObj.valueType === 'range' && typeof dimObj.min === 'number' && typeof dimObj.max === 'number') {
            allMins.push(dimObj.min)
            allMaxes.push(dimObj.max)
          } else if (dimObj.valueType === 'selection' && dimObj.options) {
            // For selection type, convert options to numbers
            // Handle numeric options directly
            const numericOptions = dimObj.options.filter((opt: any) => typeof opt === 'number') as number[]
            // Handle string options that can be converted (e.g., "yes"/"no" -> 1/0)
            const stringToNumber: number[] = []
            dimObj.options.forEach((opt: any) => {
              if (typeof opt === 'string') {
                const lowerOpt = opt.toLowerCase()
                if (lowerOpt === 'yes' || lowerOpt === 'true' || lowerOpt === '1') {
                  stringToNumber.push(1)
                } else if (lowerOpt === 'no' || lowerOpt === 'false' || lowerOpt === '0') {
                  stringToNumber.push(0)
                }
              }
            })
            const allNumericOptions = [...numericOptions, ...stringToNumber]
            if (allNumericOptions.length > 0) {
              allMins.push(Math.min(...allNumericOptions))
              allMaxes.push(Math.max(...allNumericOptions))
            }
          }
        })
        
        if (allMins.length === 0 || allMaxes.length === 0) return null
        
        const overallMin = Math.max(...allMins) // Biggest of all minimums
        const overallMax = Math.min(...allMaxes) // Smallest of all maximums
        
        // Get current values from cabinets in the scene
        // For each cabinet, get the value from cabinetPanelState or use defaultValue
        const currentValues: number[] = []
        cabinetsWithThisGD.forEach(({ cabinet, dimId, dimObj }) => {
          const persisted = cabinetPanelState.get(cabinet.cabinetId)
          let currentValue = persisted?.values?.[dimId] ?? dimObj.defaultValue
          
          // For selection type, convert string values to numbers if needed (e.g., "yes"/"no" -> 1/0)
          if (dimObj.valueType === 'selection') {
            if (typeof currentValue === 'string') {
              // Convert "yes"/"no" or similar to 1/0
              const lowerVal = currentValue.toLowerCase()
              if (lowerVal === 'yes' || lowerVal === 'true' || lowerVal === '1') {
                currentValue = 1
              } else if (lowerVal === 'no' || lowerVal === 'false' || lowerVal === '0') {
                currentValue = 0
              } else {
                // Try to find numeric option
                const numericOpt = dimObj.options?.find((opt: any) => String(opt).toLowerCase() === lowerVal && typeof opt === 'number')
                if (numericOpt !== undefined) {
                  currentValue = numericOpt as number
                }
              }
            }
          } else if (dimObj.valueType === 'range') {
            currentValue = currentValue ?? dimObj.min
          }
          
          if (typeof currentValue === 'number') {
            currentValues.push(currentValue)
          }
        })
        
        // Use the first current value as the display value (or average if multiple)
        const currentValue = currentValues.length > 0 
          ? (currentValues.length === 1 ? currentValues[0] : Math.round(currentValues.reduce((a, b) => a + b, 0) / currentValues.length))
          : (overallMin + overallMax) / 2
        
        return {
          gdId,
          name: gd.GD || gdId,
          threeJsType: gd.threeJsType,
          min: overallMin,
          max: overallMax,
          currentValue,
          cabinetsWithThisGD, // Store for potential future use
        }
      })
      .filter((gd): gd is NonNullable<typeof gd> => gd !== null)
  }, [allGDIds, wsProducts, productQueries, uniqueProductIds, viewCabinets])

  // State for slider values
  const [sliderValues, setSliderValues] = useState<Record<string, number>>({})
  
  // Calculate current gap between ALL base/tall and ALL top cabinets in the view (globally)
  const calculateCurrentGap = useCallback((targetCabinets: CabinetData[]): number => {
    if (targetCabinets.length < 2) return 20

    // Get all base/tall cabinets
    const baseTallCabinets = targetCabinets.filter(c => c.cabinetType === 'base' || c.cabinetType === 'tall')

    // Get all overhead (top) cabinets
    const overheadCabinets = targetCabinets.filter(c => c.cabinetType === 'top')

    // If no base/tall or no overhead cabinets, return default
    if (baseTallCabinets.length === 0 || overheadCabinets.length === 0) return 20

    // Find the HIGHEST base/tall cabinet top (Y + height)
    const highestBaseTop = Math.max(
      ...baseTallCabinets.map(c => c.group.position.y + c.carcass.dimensions.height)
    )

    // Find the LOWEST overhead cabinet Y position (bottom)
    const lowestOverheadY = Math.min(
      ...overheadCabinets.map(c => c.group.position.y)
    )

    // Calculate gap: Lowest Overhead Y minus Highest Base Top
    if (lowestOverheadY > highestBaseTop) {
      const gap = lowestOverheadY - highestBaseTop
      return Math.round(gap)
    }

    // If overhead is below base (shouldn't happen normally), return default
    return 20
  }, [])

  // Calculate current kicker height from base/tall cabinets in the view
  const calculateCurrentKickerHeight = useCallback((targetCabinets: CabinetData[]): number => {
    // Get all base/tall cabinets
    const baseTallCabinets = targetCabinets.filter(c => c.cabinetType === 'base' || c.cabinetType === 'tall')

    if (baseTallCabinets.length === 0) return 100

    // Kicker height is the Y position of base/tall cabinets
    // Get the most common kicker height (or average if they differ)
    const kickerHeights = baseTallCabinets.map(c => c.group.position.y)

    // Return the first kicker height found (they should all be the same in a view)
    // If they differ, return the most common one or average
    if (kickerHeights.length > 0) {
      // Round to nearest integer
      return Math.round(kickerHeights[0])
    }

    return 100
  }, [])

  // Calculate min/max splashback height (max is fixed at 1000mm, constraints applied in handler)
  const calculateSplashbackLimits = useCallback((viewId: string | null): { min: number; max: number } => {
    const min = 20 // Minimum reasonable gap
    const max = 1000 // Maximum allowed (constraints will be applied when positioning cabinets)
    
    return { min, max }
  }, [])

  // State for kicker height - initialize with current value
  const [kickerHeightValue, setKickerHeightValue] = useState(() => {
    return calculateCurrentKickerHeight(viewCabinets)
  })

  // State for splashback height - initialize with current gap
  const [splashbackHeightValue, setSplashbackHeightValue] = useState(() => {
    return calculateCurrentGap(viewCabinets)
  })

  // Calculate splashback limits
  const splashbackLimits = useMemo(() => {
    return calculateSplashbackLimits(viewId)
  }, [viewId, calculateSplashbackLimits])

  // Ref to track initialization to prevent infinite loops
  const lastInitializedRef = useRef<{ isOpen: boolean; viewId: string | null }>({
    isOpen: false,
    viewId: null
  })

  // Reset initialization when drawer closes
  React.useEffect(() => {
    if (!isOpen) {
      lastInitializedRef.current = { isOpen: false, viewId: null }
    }
  }, [isOpen])

  // Update kicker height when drawer opens or viewId changes
  React.useEffect(() => {
    const shouldInitialize = isOpen && viewId && (
      lastInitializedRef.current.isOpen !== isOpen || 
      lastInitializedRef.current.viewId !== viewId
    )

    if (shouldInitialize) {
      const currentKickerHeight = calculateCurrentKickerHeight(viewCabinets)
      // Clamp to valid range (16-170mm)
      const clampedKickerHeight = Math.max(16, Math.min(170, currentKickerHeight))
      setKickerHeightValue(clampedKickerHeight)
    }
  }, [isOpen, viewId, calculateCurrentKickerHeight, viewCabinets])

  // Update splashback height when drawer opens or viewId changes
  React.useEffect(() => {
    const shouldInitialize = isOpen && viewId && (
      lastInitializedRef.current.isOpen !== isOpen || 
      lastInitializedRef.current.viewId !== viewId
    )

    if (shouldInitialize) {
      const currentGap = calculateCurrentGap(viewCabinets)
      // Clamp current gap to valid range
      const clampedGap = Math.max(
        splashbackLimits.min,
        Math.min(splashbackLimits.max, currentGap)
      )
      setSplashbackHeightValue(clampedGap)
    }
  }, [isOpen, viewId, calculateCurrentGap, splashbackLimits, viewCabinets])
  
  // Group dimensions by threeJsType
  const groupedDimensions = useMemo(() => {
    const groups: Record<string, typeof gdListWithSliders> = {}
    
    gdListWithSliders.forEach((gd) => {
      const category = gd.threeJsType || 'other'
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(gd)
    })
    
    return groups
  }, [gdListWithSliders])
  
  // Initialize slider values from current values
  React.useEffect(() => {
    const shouldInitialize = isOpen && viewId && (
      lastInitializedRef.current.isOpen !== isOpen || 
      lastInitializedRef.current.viewId !== viewId
    )

    if (shouldInitialize && gdListWithSliders.length > 0) {
      const initialValues: Record<string, number> = {}
      gdListWithSliders.forEach((gd) => {
        initialValues[gd.gdId] = gd.currentValue
      })
      setSliderValues(initialValues)
      
      // Mark as initialized after all initializations are done
      lastInitializedRef.current = { isOpen, viewId }
    }
  }, [isOpen, viewId, gdListWithSliders])
  
  // Format category name for display
  const formatCategoryName = (category: string): string => {
    if (category === 'other') return 'Other'
    return category.charAt(0).toUpperCase() + category.slice(1)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
            className="fixed top-0 right-0 h-full w-96 bg-white shadow-xl z-[70] overflow-y-auto"
            data-view-drawer
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
              <h2 className="text-xl font-bold text-gray-800 flex-1">{viewName} Settings</h2>
            </div>

            {/* Content */}
            <div className="p-4">
              {viewId &&
                formulaPieces &&
                getGDFormula &&
                onGDFormulaChange && (
                  <GDFormulaSection
                    viewId={viewId as ViewId}
                    gdList={gdListWithSliders.map((gd) => ({
                      gdId: gd.gdId,
                      name: gd.name,
                    }))}
                    pieces={formulaPieces}
                    getGDFormula={getGDFormula}
                    onGDFormulaChange={onGDFormulaChange}
                    getGDFormulaLastEvaluatedAt={getGDFormulaLastEvaluatedAt}
                    activeCabinetId={viewCabinets[0]?.cabinetId}
                  />
                )}

              <h3 className="text-lg font-semibold text-gray-800 mb-4">Global Dimensions</h3>
              
              {!wsProducts ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No WsProducts data available.</p>
                </div>
              ) : gdListWithSliders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No Global Dimensions found.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedDimensions)
                    .sort(([a], [b]) => {
                      // Sort: height, depth, width, kicker, shelfQty, other
                      const order: Record<string, number> = {
                        height: 1,
                        depth: 2,
                        width: 3,
                        kicker: 4,
                        shelfQty: 5,
                        other: 6,
                      }
                      return (order[a] || 99) - (order[b] || 99)
                    })
                    .map(([category, dimensions]) => (
                      <div
                        key={category}
                        className="border border-gray-200 rounded-lg bg-white p-4"
                      >
                        {/* Section Header */}
                        <h3 className="font-semibold text-gray-800 mb-4">
                          {formatCategoryName(category)}
                        </h3>
                        
                        {/* Dimensions */}
                        <div className="space-y-4">
                          {dimensions.map((gd) => (
                            <div
                              key={gd.gdId}
                            >
                              <h4 className="font-medium text-gray-700 mb-3 text-sm">{gd.name}</h4>
                              
                              {/* Number input and slider */}
                              <div>
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <input
                                    type="number"
                                    className="w-20 text-center text-sm px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-tight"
                                    value={sliderValues[gd.gdId] ?? gd.currentValue}
                                    min={gd.min}
                                    max={gd.max}
                                    onChange={(e) => {
                                      const val = Number(e.target.value)
                                      if (val >= gd.min && val <= gd.max) {
                                        setSliderValues(prev => ({ ...prev, [gd.gdId]: val }))
                                        
                                        // Build product data map from already-fetched queries
                                        const productDataMap = new Map<string, any>()
                                        productQueries.forEach((query, index) => {
                                          const productId = uniqueProductIds[index]
                                          if (productId && query.data) {
                                            productDataMap.set(productId, query.data)
                                          }
                                        })
                                        
                                        // Notify parent to update all related cabinets
                                        onDimensionChange?.(gd.gdId, val, productDataMap)
                                      }
                                    }}
                                  />
                                  <span className="text-sm text-gray-500">mm</span>
                                </div>
                                <input
                                  type="range"
                                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                                  value={sliderValues[gd.gdId] ?? gd.currentValue}
                                  min={gd.min}
                                  max={gd.max}
                                  onChange={(e) => {
                                    let val: number | string = Number(e.target.value)
                                    
                                    // For selection type dimensions, we might need to convert back to original format
                                    // But for now, we'll use numeric values for sliders
                                    setSliderValues(prev => ({ ...prev, [gd.gdId]: val }))
                                    
                                    // Build product data map from already-fetched queries
                                    const productDataMap = new Map<string, any>()
                                    productQueries.forEach((query, index) => {
                                      const productId = uniqueProductIds[index]
                                      if (productId && query.data) {
                                        productDataMap.set(productId, query.data)
                                      }
                                    })
                                    
                                    // Notify parent to update all related cabinets (real-time like ProductPanel)
                                    onDimensionChange?.(gd.gdId, val, productDataMap)
                                  }}
                                />
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                  <span>{gd.min}</span>
                                  <span>{gd.max}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}

            </div>
            
            {/* Kicker Height Control - above Splashback */}
            {viewId && onKickerHeightChange && (
              <div className="mt-6 pt-6 border-t border-gray-300">
                <div className="border border-gray-200 rounded-lg bg-white p-4">
                  <h3 className="font-semibold text-gray-800 mb-4">Kicker Height</h3>
                  <KickerHeightSection
                    viewId={viewId}
                    currentKickerHeight={kickerHeightValue}
                    onKickerHeightChange={onKickerHeightChange}
                  />
                </div>
              </div>
            )}

            {/* Splashback Height Control - at the bottom */}
            {viewId && (
              <div className="mt-6 pt-6 border-t border-gray-300">
                <div className="border border-gray-200 rounded-lg bg-white p-4">
                  <h3 className="font-semibold text-gray-800 mb-4">Splashback Height</h3>
                  <div>
                    <h4 className="font-medium text-gray-700 mb-3 text-sm">Gap between Overhead and Base Cabinets</h4>
                    
                    {/* Number input and slider */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <input
                          type="number"
                          className="w-20 text-center text-sm px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-tight"
                          value={splashbackHeightValue}
                          min={splashbackLimits.min}
                          max={splashbackLimits.max}
                          onChange={(e) => {
                            const val = Number(e.target.value)
                            if (val >= splashbackLimits.min && val <= splashbackLimits.max && viewId) {
                              setSplashbackHeightValue(val)
                              onSplashbackHeightChange?.(viewId, val)
                            }
                          }}
                        />
                        <span className="text-sm text-gray-500">mm</span>
                      </div>
                      <input
                        type="range"
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        value={splashbackHeightValue}
                        min={splashbackLimits.min}
                        max={splashbackLimits.max}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          if (viewId) {
                            setSplashbackHeightValue(val)
                            onSplashbackHeightChange?.(viewId, val)
                          }
                        }}
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{splashbackLimits.min}</span>
                        <span>{splashbackLimits.max}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

