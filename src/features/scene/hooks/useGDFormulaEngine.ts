import { useCallback, useEffect, useMemo, useRef } from "react"
import type { Dispatch, SetStateAction } from "react"
import debounce from "lodash/debounce"
import { evaluate, isBigNumber } from "mathjs"
import type { CabinetData, WallDimensions } from "../types"
import type { ViewId } from "@/features/cabinets/ViewManager"
import { getClient } from "@/app/QueryProvider"
import { priceQueryKeys } from "@/features/cabinets/ui/productPanel/utils/queryKeys"
import { getPersistedState } from "@/features/cabinets/ui/productPanel/hooks/usePersistence"
import { getDefaultDimValue } from "@/features/cabinets/ui/productPanel/utils/dimensionUtils"
import { getEffectiveLeftEdge, getEffectiveRightEdge } from "../lib/snapUtils"
import {
  getApplianceGapValues,
  getApplianceVisualDimensions,
} from "../utils/handlers/applianceGapHandler"
import {
  DEFAULT_BENCHTOP_FRONT_OVERHANG,
  DEFAULT_BENCHTOP_THICKNESS,
} from "@/features/carcass/builders/builder-constants"
import { handleViewDimensionChange } from "../utils/handlers/viewDimensionHandler"
import {
  realignAllViews,
  type ViewManagerResult,
} from "../utils/handlers/viewRealignHandler"
import { ProductDataResponse } from "@/server/getProductData"

const EPSILON = 0.1
const MAX_PASSES = 3

type UseGDFormulaEngineArgs = {
  cabinets: CabinetData[]
  cabinetGroups: Map<string, Array<{ cabinetId: string; percentage: number }>>
  viewManager: ViewManagerResult
  wallDimensions: WallDimensions
  viewGDFormulas: Map<ViewId, Record<string, string>>
  setViewGDFormulas: Dispatch<
    SetStateAction<Map<ViewId, Record<string, string>>>
  >
  onFormulasApplied?: () => void
}

type UseGDFormulaEngineReturn = {
  getGDFormula: (viewId: ViewId, gdId: string) => string | undefined
  setGDFormula: (viewId: ViewId, gdId: string, formula: string | null) => void
  scheduleGDFormulaRecalc: () => void
  getGDFormulaLastEvaluatedAt: (
    viewId: ViewId,
    gdId: string
  ) => number | undefined
}

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const num = Number(value)
    return Number.isFinite(num) ? num : null
  }
  return null
}

const isFiniteNumber = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value)

const normalizeResult = (result: unknown): number | null => {
  if (typeof result === "number") return Number.isFinite(result) ? result : null
  if (isBigNumber(result)) return result.toNumber()
  if (
    result &&
    typeof (result as { toNumber?: () => number }).toNumber === "function"
  ) {
    const num = (result as { toNumber: () => number }).toNumber()
    return Number.isFinite(num) ? num : null
  }
  return null
}

const getApplianceFormulaValue = (
  cabinet: CabinetData,
  dimId: string
): number | null => {
  const visual = getApplianceVisualDimensions(cabinet)
  const gaps = getApplianceGapValues(cabinet)

  switch (dimId) {
    case "appliance:width":
      return visual.width
    case "appliance:height":
      return visual.height
    case "appliance:depth":
      return visual.depth
    case "appliance:gapTop":
      return gaps.topGap
    case "appliance:gapLeft":
      return gaps.leftGap
    case "appliance:gapRight":
      return gaps.rightGap
    case "appliance:kickerHeight":
      return gaps.kickerHeight
    default:
      return null
  }
}

const getBenchtopFormulaValue = (
  cabinet: CabinetData,
  dimId: string
): number | null => {
  const heightFromFloor =
    cabinet.benchtopHeightFromFloor ?? cabinet.group.position.y
  const thickness =
    cabinet.benchtopThickness ??
    cabinet.carcass.benchtop?.thickness ??
    cabinet.carcass.dimensions.height ??
    DEFAULT_BENCHTOP_THICKNESS
  const frontOverhang =
    cabinet.benchtopFrontOverhang ??
    cabinet.carcass.config.benchtopFrontOverhang ??
    DEFAULT_BENCHTOP_FRONT_OVERHANG
  const leftOverhang =
    cabinet.benchtopLeftOverhang ??
    cabinet.carcass.config.benchtopLeftOverhang ??
    0
  const rightOverhang =
    cabinet.benchtopRightOverhang ??
    cabinet.carcass.config.benchtopRightOverhang ??
    0

  switch (dimId) {
    case "benchtop:heightFromFloor":
      return heightFromFloor
    case "benchtop:thickness":
      return thickness
    case "benchtop:frontOverhang":
      return frontOverhang
    case "benchtop:leftOverhang":
      return leftOverhang
    case "benchtop:rightOverhang":
      return rightOverhang
    default:
      return null
  }
}

const getFillerPanelFormulaValue = (
  cabinet: CabinetData,
  dimId: string
): number | null => {
  if (dimId === "fillerPanel:offTheFloor") {
    return cabinet.parentYOffset ?? cabinet.group.position.y
  }

  return null
}

export function useGDFormulaEngine({
  cabinets,
  cabinetGroups,
  viewManager,
  wallDimensions,
  viewGDFormulas,
  setViewGDFormulas,
  onFormulasApplied,
}: UseGDFormulaEngineArgs): UseGDFormulaEngineReturn {
  const cabinetById = useMemo(
    () => new Map(cabinets.map((cabinet) => [cabinet.cabinetId, cabinet])),
    [cabinets]
  )

  const getProductDataCached = useCallback((productId: string | undefined) => {
    if (!productId) return undefined
    return getClient().getQueryData(
      priceQueryKeys.productData(productId)
    ) as ProductDataResponse
  }, [])

  const isApplyingRef = useRef(false)
  const recalcRef = useRef<() => void>(() => {})
  const realignAllRef = useRef<() => void>(() => {})
  const lastEvaluatedAtRef = useRef<Map<string, number>>(new Map())

  const scheduleGDFormulaRecalc = useMemo(() => {
    const debouncedRecalc = debounce(() => {
      recalcRef.current()
    }, 300)

    const debouncedRealign = debounce(() => {
      realignAllRef.current()
    }, 400)

    const trigger = () => {
      debouncedRecalc()
      debouncedRealign()
    }

    trigger.cancel = () => {
      debouncedRecalc.cancel()
      debouncedRealign.cancel()
    }

    return trigger
  }, [])

  const getGDFormula = useCallback(
    (viewId: ViewId, gdId: string) => viewGDFormulas.get(viewId)?.[gdId],
    [viewGDFormulas]
  )

  const setGDFormula = useCallback(
    (viewId: ViewId, gdId: string, formula: string | null) => {
      setViewGDFormulas((prev) => {
        const next = new Map(prev)
        const current = next.get(viewId) ?? {}
        const updated: Record<string, string> = { ...current }

        if (!formula || formula.trim() === "") {
          delete updated[gdId]
        } else {
          updated[gdId] = formula.trim()
        }

        if (Object.keys(updated).length === 0) {
          next.delete(viewId)
        } else {
          next.set(viewId, updated)
        }

        return next
      })
      scheduleGDFormulaRecalc()
    },
    [scheduleGDFormulaRecalc, setViewGDFormulas]
  )

  const getCabinetField = useCallback(
    (cabinetId: string, field: string): number | null => {
      const cabinet = cabinetById.get(cabinetId)
      if (!cabinet) return null

      const { x, y, z } = cabinet.group.position
      const { width, height, depth } = cabinet.carcass.dimensions
      if (field === "x") return x
      if (field === "y") return y
      if (field === "z") return z
      if (field === "width") return width
      if (field === "height") return height
      if (field === "depth") return depth
      if (field === "left") return getEffectiveLeftEdge(cabinet, cabinets)
      if (field === "right") return getEffectiveRightEdge(cabinet, cabinets)
      if (field === "top") return y + height
      if (field === "bottom") return y

      if (cabinet.cabinetType === "appliance") {
        const visual = getApplianceVisualDimensions(cabinet)
        const gaps = getApplianceGapValues(cabinet)
        if (field === "visualWidth") return visual.width
        if (field === "visualHeight") return visual.height
        if (field === "visualDepth") return visual.depth
        if (field === "gapTop") return gaps.topGap
        if (field === "gapLeft") return gaps.leftGap
        if (field === "gapRight") return gaps.rightGap
        if (field === "kickerHeight") return gaps.kickerHeight
        if (field === "shellWidth") return width
        if (field === "shellHeight") return height
        if (field === "shellDepth") return depth
      }

      return null
    },
    [cabinetById, cabinets]
  )

  const getCabinetDimValue = useCallback(
    (cabinetId: string, dimId: string): number | null => {
      const cabinet = cabinetById.get(cabinetId)
      if (!cabinet) return null

      if (cabinet.cabinetType === "appliance") {
        const applianceVal = getApplianceFormulaValue(cabinet, dimId)
        if (isFiniteNumber(applianceVal)) return applianceVal
      }

      if (cabinet.cabinetType === "benchtop") {
        const benchtopVal = getBenchtopFormulaValue(cabinet, dimId)
        if (isFiniteNumber(benchtopVal)) return benchtopVal
      }

      if (cabinet.cabinetType === "filler" || cabinet.cabinetType === "panel") {
        const fillerPanelVal = getFillerPanelFormulaValue(cabinet, dimId)
        if (isFiniteNumber(fillerPanelVal)) return fillerPanelVal
      }

      const persisted = getPersistedState(cabinetId)
      const persistedVal = toNumber(persisted?.values?.[dimId])
      if (isFiniteNumber(persistedVal)) return persistedVal

      if (!cabinet.productId) return null
      const cached = getProductDataCached(cabinet.productId) as any
      const dimObj = cached?.product?.dims?.[dimId]
      if (!dimObj) return null

      const fallback = getDefaultDimValue(dimObj)
      return toNumber(fallback)
    },
    [cabinetById, getProductDataCached]
  )

  const getViewGdValue = useCallback(
    (viewId: string, gdId: string): number | null => {
      if (!viewId || viewId === "none") return null
      const cabinetIds = viewManager.getCabinetsInView(viewId as ViewId)

      for (const cabinetId of cabinetIds) {
        const cabinet = cabinetById.get(cabinetId)
        if (!cabinet?.productId) continue
        const cached = getProductDataCached(cabinet.productId)
        const dims = cached?.product?.dims
        if (!dims) continue
        const dimEntry = Object.entries(dims).find(
          ([, dimObj]) => dimObj?.GDId === gdId && dimObj?.visible !== false
        )
        if (!dimEntry) continue
        const dimId = dimEntry[0]
        const value = getCabinetDimValue(cabinet.cabinetId, dimId)
        if (isFiniteNumber(value)) return value
      }

      return null
    },
    [cabinetById, getCabinetDimValue, getProductDataCached, viewManager]
  )

  const buildProductDataMap = useCallback(
    (viewCabinets: CabinetData[]) => {
      const productDataMap = new Map<string, any>()
      viewCabinets.forEach((cabinet) => {
        if (!cabinet.productId) return
        const cached = getProductDataCached(cabinet.productId)
        if (cached) {
          productDataMap.set(cabinet.productId, cached)
        }
      })
      return productDataMap
    },
    [getProductDataCached]
  )

  const recalcFormulas = useCallback(() => {
    if (isApplyingRef.current) return
    isApplyingRef.current = true
    let anyApplied = false
    const appliedKeys: string[] = []

    try {
      for (let pass = 0; pass < MAX_PASSES; pass += 1) {
        let passApplied = false
        const scope = {
          cab: (cabinetId: string, field: string) =>
            getCabinetField(cabinetId, field) ?? 0,
          dim: (cabinetId: string, dimId: string) =>
            getCabinetDimValue(cabinetId, dimId) ?? 0,
          viewGd: (viewId: string, gdId: string) =>
            getViewGdValue(viewId, gdId) ?? 0,
        }

        viewGDFormulas.forEach((formulas, viewId) => {
          if (!formulas || Object.keys(formulas).length === 0) return
          const cabinetIds = viewManager.getCabinetsInView(viewId)
          const viewCabinets = cabinetIds
            .map((cabinetId) => cabinetById.get(cabinetId))
            .filter((cabinet): cabinet is CabinetData => !!cabinet)

          if (viewCabinets.length === 0) return
          const productDataMap = buildProductDataMap(viewCabinets)
          if (productDataMap.size === 0) return

          Object.entries(formulas).forEach(([gdId, formula]) => {
            if (!formula || formula.trim() === "") return
            let result: number | null = null
            try {
              result = normalizeResult(evaluate(formula, scope))
            } catch (error) {
              console.warn("[gdFormulaEngine] Invalid formula:", formula, error)
              return
            }
            if (!isFiniteNumber(result)) return

            const current = getViewGdValue(viewId, gdId)
            if (
              isFiniteNumber(current) &&
              Math.abs(result - current) < EPSILON
            ) {
              return
            }

            handleViewDimensionChange(gdId, result, productDataMap, {
              cabinets,
              cabinetGroups,
              viewManager,
              wallDimensions,
              viewId,
            })
            passApplied = true
            anyApplied = true
            appliedKeys.push(`${viewId}:${gdId}`)
          })
        })

        if (!passApplied) break
      }
    } catch (error) {
      console.warn("[gdFormulaEngine] Failed to apply formulas:", error)
    } finally {
      isApplyingRef.current = false
    }

    if (anyApplied) {
      const now = Date.now()
      appliedKeys.forEach((key) => {
        lastEvaluatedAtRef.current.set(key, now)
      })
      onFormulasApplied?.()
    }
  }, [
    buildProductDataMap,
    cabinetById,
    cabinetGroups,
    cabinets,
    getCabinetDimValue,
    getCabinetField,
    getViewGdValue,
    onFormulasApplied,
    viewGDFormulas,
    viewManager,
    wallDimensions,
  ])

  recalcRef.current = recalcFormulas

  useEffect(() => {
    realignAllRef.current = () => {
      realignAllViews(cabinets, viewManager, wallDimensions)
    }
  }, [cabinets, viewManager, wallDimensions])

  const getGDFormulaLastEvaluatedAt = useCallback(
    (viewId: ViewId, gdId: string) =>
      lastEvaluatedAtRef.current.get(`${viewId}:${gdId}`),
    []
  )

  useEffect(() => {
    return () => {
      scheduleGDFormulaRecalc.cancel()
    }
  }, [scheduleGDFormulaRecalc])

  return {
    getGDFormula,
    setGDFormula,
    scheduleGDFormulaRecalc,
    getGDFormulaLastEvaluatedAt,
  }
}
