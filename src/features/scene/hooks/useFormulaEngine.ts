import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import debounce from "lodash/debounce"
import { evaluate, isBigNumber } from "mathjs"
import type { CabinetData, WallDimensions } from "../types"
import type { ViewId } from "@/features/cabinets/ViewManager"
import { getClient } from "@/app/QueryProvider"
import { priceQueryKeys } from "@/features/cabinets/ui/productPanel/utils/queryKeys"
import {
  cabinetPanelState,
  getPersistedState,
  setPersistedState,
} from "@/features/cabinets/ui/productPanel/hooks/usePersistence"
import {
  getGDMapping,
  getDrawerHeightIndex,
} from "@/features/cabinets/ui/productPanel/hooks/useGDMapping"
import {
  buildDimsList,
  getDefaultDimValue,
  getDimensionTypeForEditing,
} from "@/features/cabinets/ui/productPanel/utils/dimensionUtils"
import { handleProductDimensionChange } from "../utils/handlers/productDimensionHandler"
import {
  handleApplianceHorizontalGapChange,
  handleApplianceWidthChange,
} from "../utils/handlers/applianceDimensionHandler"
import {
  applyApplianceGapChange,
  getApplianceGapValues,
  getApplianceVisualDimensions,
} from "../utils/handlers/applianceGapHandler"
import { updateAllDependentComponents } from "../utils/handlers/dependentComponentsHandler"
import { getEffectiveLeftEdge, getEffectiveRightEdge } from "../lib/snapUtils"
import type { FormulaPiece } from "@/types/formulaTypes"
import {
  APPLIANCE_FORMULA_DIM_ID_SET,
  BENCHTOP_FORMULA_DIM_ID_SET,
  FILLER_PANEL_FORMULA_DIM_ID_SET,
} from "@/types/formulaTypes"
import {
  BENCHTOP_FIXED_DEPTH_EXTENSION,
  DEFAULT_BENCHTOP_FRONT_OVERHANG,
  DEFAULT_BENCHTOP_THICKNESS,
} from "@/features/carcass/builders/builder-constants"
import { updateBenchtopPosition } from "../utils/handlers/benchtopPositionHandler"

const EPSILON = 0.1
const DEFAULT_MATERIAL_COLOR = "#ffffff"
const MAX_PASSES = 3
const isDev = process.env.NODE_ENV !== "production"

type ApplianceFormulaDimId = typeof APPLIANCE_FORMULA_DIM_ID_SET extends Set<
  infer T
>
  ? T
  : never

const isApplianceFormulaDimId = (
  dimId: string
): dimId is ApplianceFormulaDimId =>
  APPLIANCE_FORMULA_DIM_ID_SET.has(dimId as ApplianceFormulaDimId)

type BenchtopFormulaDimId = typeof BENCHTOP_FORMULA_DIM_ID_SET extends Set<
  infer T
>
  ? T
  : never

const isBenchtopFormulaDimId = (
  dimId: string
): dimId is BenchtopFormulaDimId =>
  BENCHTOP_FORMULA_DIM_ID_SET.has(dimId as BenchtopFormulaDimId)

type FillerPanelFormulaDimId = typeof FILLER_PANEL_FORMULA_DIM_ID_SET extends Set<
  infer T
>
  ? T
  : never

const isFillerPanelFormulaDimId = (
  dimId: string
): dimId is FillerPanelFormulaDimId =>
  FILLER_PANEL_FORMULA_DIM_ID_SET.has(dimId as FillerPanelFormulaDimId)

interface ViewManagerResult {
  getCabinetsInView: (viewId: ViewId) => string[]
}

type UseFormulaEngineArgs = {
  cabinets: CabinetData[]
  selectedCabinets: CabinetData[]
  setSelectedCabinets: Dispatch<SetStateAction<CabinetData[]>>
  cabinetGroups: Map<string, Array<{ cabinetId: string; percentage: number }>>
  cabinetSyncs: Map<string, string[]>
  viewManager: ViewManagerResult
  wallDimensions: WallDimensions
  onFormulasApplied?: () => void
}

type UseFormulaEngineReturn = {
  formulaPieces: FormulaPiece[]
  getFormula: (cabinetId: string, dimId: string) => string | undefined
  setFormula: (cabinetId: string, dimId: string, formula: string | null) => void
  scheduleFormulaRecalc: () => void
  getFormulaLastEvaluatedAt: (cabinetId: string) => number | undefined
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

const ensurePersistedState = (cabinet: CabinetData) => {
  const current = getPersistedState(cabinet.cabinetId)
  if (current) return current

  const materialColor =
    cabinet.carcass?.config?.material?.getColour?.() ?? DEFAULT_MATERIAL_COLOR
  const base = {
    values: {},
    materialColor,
    formulas: {},
  }
  cabinetPanelState.set(cabinet.cabinetId, base)
  return base
}

const getCabinetLabel = (cabinet: CabinetData): string => {
  if (cabinet.sortNumber) return `Cabinet #${cabinet.sortNumber}`
  return `Cabinet ${cabinet.cabinetId.slice(-6)}`
}

const buildFormulaPieces = (
  cabinets: CabinetData[],
  getProductDataCached: (productId: string | undefined) => any
): FormulaPiece[] => {
  const pieces: FormulaPiece[] = []

  cabinets.forEach((cabinet) => {
    const label = getCabinetLabel(cabinet)
    const baseGroup = `${label}`

    const geomGroup = `${baseGroup} - Geometry`
    const cabId = cabinet.cabinetId
    pieces.push(
      {
        id: `${cabId}-x`,
        label: "Position X",
        token: `cab("${cabId}", "x")`,
        group: geomGroup,
      },
      {
        id: `${cabId}-y`,
        label: "Position Y",
        token: `cab("${cabId}", "y")`,
        group: geomGroup,
      },
      {
        id: `${cabId}-z`,
        label: "Position Z",
        token: `cab("${cabId}", "z")`,
        group: geomGroup,
      },
      {
        id: `${cabId}-width`,
        label: "Width",
        token: `cab("${cabId}", "width")`,
        group: geomGroup,
      },
      {
        id: `${cabId}-height`,
        label: "Height",
        token: `cab("${cabId}", "height")`,
        group: geomGroup,
      },
      {
        id: `${cabId}-depth`,
        label: "Depth",
        token: `cab("${cabId}", "depth")`,
        group: geomGroup,
      },
      {
        id: `${cabId}-left`,
        label: "Left Edge",
        token: `cab("${cabId}", "left")`,
        group: geomGroup,
      },
      {
        id: `${cabId}-right`,
        label: "Right Edge",
        token: `cab("${cabId}", "right")`,
        group: geomGroup,
      },
      {
        id: `${cabId}-top`,
        label: "Top Edge",
        token: `cab("${cabId}", "top")`,
        group: geomGroup,
      },
      {
        id: `${cabId}-bottom`,
        label: "Bottom Edge",
        token: `cab("${cabId}", "bottom")`,
        group: geomGroup,
      }
    )

    if (cabinet.cabinetType === "appliance") {
      const applianceGroup = `${baseGroup} - Appliance`
      pieces.push(
        {
          id: `${cabId}-visualWidth`,
          label: "Visual Width",
          token: `cab("${cabId}", "visualWidth")`,
          group: applianceGroup,
        },
        {
          id: `${cabId}-visualHeight`,
          label: "Visual Height",
          token: `cab("${cabId}", "visualHeight")`,
          group: applianceGroup,
        },
        {
          id: `${cabId}-visualDepth`,
          label: "Visual Depth",
          token: `cab("${cabId}", "visualDepth")`,
          group: applianceGroup,
        },
        {
          id: `${cabId}-gapTop`,
          label: "Top Gap",
          token: `cab("${cabId}", "gapTop")`,
          group: applianceGroup,
        },
        {
          id: `${cabId}-gapLeft`,
          label: "Left Gap",
          token: `cab("${cabId}", "gapLeft")`,
          group: applianceGroup,
        },
        {
          id: `${cabId}-gapRight`,
          label: "Right Gap",
          token: `cab("${cabId}", "gapRight")`,
          group: applianceGroup,
        },
        {
          id: `${cabId}-kicker`,
          label: "Kicker Height",
          token: `cab("${cabId}", "kickerHeight")`,
          group: applianceGroup,
        },
        {
          id: `${cabId}-shellWidth`,
          label: "Shell Width",
          token: `cab("${cabId}", "shellWidth")`,
          group: applianceGroup,
        },
        {
          id: `${cabId}-shellHeight`,
          label: "Shell Height",
          token: `cab("${cabId}", "shellHeight")`,
          group: applianceGroup,
        },
        {
          id: `${cabId}-shellDepth`,
          label: "Shell Depth",
          token: `cab("${cabId}", "shellDepth")`,
          group: applianceGroup,
        }
      )
    }

    if (cabinet.cabinetType === "benchtop") {
      const benchtopGroup = `${baseGroup} - Benchtop`
      pieces.push(
        {
          id: `${cabId}-benchtop-heightFromFloor`,
          label: "Height From Floor",
          token: `dim("${cabId}", "benchtop:heightFromFloor")`,
          group: benchtopGroup,
        },
        {
          id: `${cabId}-benchtop-thickness`,
          label: "Benchtop Thickness",
          token: `dim("${cabId}", "benchtop:thickness")`,
          group: benchtopGroup,
        },
        {
          id: `${cabId}-benchtop-frontOverhang`,
          label: "Front Overhang",
          token: `dim("${cabId}", "benchtop:frontOverhang")`,
          group: benchtopGroup,
        },
        {
          id: `${cabId}-benchtop-leftOverhang`,
          label: "Left Overhang",
          token: `dim("${cabId}", "benchtop:leftOverhang")`,
          group: benchtopGroup,
        },
        {
          id: `${cabId}-benchtop-rightOverhang`,
          label: "Right Overhang",
          token: `dim("${cabId}", "benchtop:rightOverhang")`,
          group: benchtopGroup,
        }
      )
    }

    if (cabinet.cabinetType === "filler" || cabinet.cabinetType === "panel") {
      const positionGroup = `${baseGroup} - Position`
      pieces.push({
        id: `${cabId}-fillerPanel-offTheFloor`,
        label: "Off The Floor",
        token: `dim("${cabId}", "fillerPanel:offTheFloor")`,
        group: positionGroup,
      })
    }

    if (cabinet.productId) {
      const cached = getProductDataCached(cabinet.productId)
      const dims = cached?.product?.dims
      if (dims) {
        const dimsGroup = `${baseGroup} - Dimensions`
        const dimsList = buildDimsList(dims)
        dimsList.forEach(([dimId, dimObj]) => {
          const labelText = dimObj.dim || dimId
          pieces.push({
            id: `${cabId}-dim-${dimId}`,
            label: labelText,
            token: `dim("${cabId}", "${dimId}")`,
            group: dimsGroup,
          })
        })
      }
    }
  })

  return pieces
}

const getApplianceFormulaValue = (
  cabinet: CabinetData,
  dimId: string
): number | null => {
  if (!isApplianceFormulaDimId(dimId)) return null
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
  if (!isBenchtopFormulaDimId(dimId)) return null

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
  if (!isFillerPanelFormulaDimId(dimId)) return null

  if (dimId === "fillerPanel:offTheFloor") {
    return cabinet.parentYOffset ?? cabinet.group.position.y
  }

  return null
}

export function useFormulaEngine({
  cabinets,
  selectedCabinets,
  setSelectedCabinets,
  cabinetGroups,
  cabinetSyncs,
  viewManager,
  wallDimensions,
  onFormulasApplied,
}: UseFormulaEngineArgs): UseFormulaEngineReturn {
  const cabinetById = useMemo(
    () => new Map(cabinets.map((cabinet) => [cabinet.cabinetId, cabinet])),
    [cabinets]
  )

  const getProductDataCached = useCallback((productId: string | undefined) => {
    if (!productId) return undefined
    return getClient().getQueryData(priceQueryKeys.productData(productId))
  }, [])

  const formulaPieces = useMemo(
    () => buildFormulaPieces(cabinets, getProductDataCached),
    [cabinets, getProductDataCached]
  )

  const [lastEvaluatedVersion, setLastEvaluatedVersion] = useState(0)
  const lastEvaluatedAtRef = useRef<Map<string, number>>(new Map())

  const isApplyingRef = useRef(false)
  const recalcRef = useRef<() => void>(() => {})

  const scheduleFormulaRecalc = useMemo(
    () =>
      debounce(() => {
        recalcRef.current()
      }, 300),
    []
  )

  const getFormula = useCallback((cabinetId: string, dimId: string) => {
    const current = getPersistedState(cabinetId)
    return current?.formulas?.[dimId]
  }, [])

  const setFormula = useCallback(
    (cabinetId: string, dimId: string, formula: string | null) => {
      const cabinet = cabinetById.get(cabinetId)
      if (!cabinet) return
      const current = ensurePersistedState(cabinet)
      const nextFormulas: Record<string, string> = {
        ...(current.formulas || {}),
      }

      if (!formula || formula.trim() === "") {
        delete nextFormulas[dimId]
      } else {
        nextFormulas[dimId] = formula.trim()
      }

      setPersistedState(cabinetId, { ...current, formulas: nextFormulas })
      scheduleFormulaRecalc()
    },
    [cabinetById, scheduleFormulaRecalc]
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

      if (
        cabinet.cabinetType === "filler" ||
        cabinet.cabinetType === "panel"
      ) {
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

  const applyApplianceFormulaValue = useCallback(
    (
      cabinet: CabinetData,
      dimId: string,
      value: number
    ): { applied: boolean; actual?: number } => {
      if (!isApplianceFormulaDimId(dimId)) {
        return { applied: false }
      }

      if (dimId === "appliance:width") {
        const applied = handleApplianceWidthChange(value, {
          selectedCabinet: cabinet,
          selectedCabinets,
          cabinets,
          cabinetSyncs,
          cabinetGroups,
          viewManager,
          wallDimensions,
        })
        const actual = getApplianceFormulaValue(cabinet, dimId) ?? value
        return { applied, actual }
      }

      if (dimId === "appliance:gapLeft" || dimId === "appliance:gapRight") {
        const gapChange =
          dimId === "appliance:gapLeft" ? { left: value } : { right: value }
        const result = handleApplianceHorizontalGapChange(gapChange, {
          selectedCabinet: cabinet,
          selectedCabinets,
          cabinets,
          cabinetSyncs,
          cabinetGroups,
          viewManager,
          wallDimensions,
        })
        const actual = getApplianceFormulaValue(cabinet, dimId)
        return { applied: result.applied, actual: actual ?? value }
      }

      if (dimId === "appliance:gapTop") {
        const result = applyApplianceGapChange({
          cabinet,
          gaps: { top: value },
          cabinets,
          cabinetGroups,
          viewManager,
          wallDimensions,
        })
        const actual = getApplianceFormulaValue(cabinet, dimId)
        return { applied: result.applied, actual: actual ?? value }
      }

      if (dimId === "appliance:kickerHeight") {
        const visual = getApplianceVisualDimensions(cabinet)
        const gaps = getApplianceGapValues(cabinet)
        const newShellHeight = visual.height + gaps.topGap + value
        cabinet.carcass.updateDimensions({
          width: cabinet.carcass.dimensions.width,
          height: newShellHeight,
          depth: cabinet.carcass.dimensions.depth,
        })
        cabinet.carcass.updateConfig({ applianceKickerHeight: value })
        updateAllDependentComponents(cabinet, cabinets, wallDimensions, {
          heightChanged: true,
          kickerHeightChanged: true,
        })
        return { applied: true, actual: value }
      }

      if (dimId === "appliance:height") {
        const gaps = getApplianceGapValues(cabinet)
        const newShellHeight = value + gaps.topGap + gaps.kickerHeight
        cabinet.carcass.updateDimensions({
          width: cabinet.carcass.dimensions.width,
          height: newShellHeight,
          depth: cabinet.carcass.dimensions.depth,
        })
        updateAllDependentComponents(cabinet, cabinets, wallDimensions, {
          heightChanged: true,
        })
        return { applied: true, actual: value }
      }

      if (dimId === "appliance:depth") {
        cabinet.carcass.updateDimensions({
          width: cabinet.carcass.dimensions.width,
          height: cabinet.carcass.dimensions.height,
          depth: value,
        })
        updateAllDependentComponents(cabinet, cabinets, wallDimensions, {
          depthChanged: true,
        })
        return { applied: true, actual: value }
      }

      return { applied: false }
    },
    [
      cabinets,
      cabinetGroups,
      cabinetSyncs,
      selectedCabinets,
      viewManager,
      wallDimensions,
    ]
  )

  const applyBenchtopFormulaValue = useCallback(
    (
      cabinet: CabinetData,
      dimId: string,
      value: number
    ): { applied: boolean; actual?: number } => {
      if (!isBenchtopFormulaDimId(dimId)) {
        return { applied: false }
      }

      const currentFrontOverhang =
        cabinet.benchtopFrontOverhang ??
        cabinet.carcass.config.benchtopFrontOverhang ??
        DEFAULT_BENCHTOP_FRONT_OVERHANG
      const currentLeftOverhang =
        cabinet.benchtopLeftOverhang ??
        cabinet.carcass.config.benchtopLeftOverhang ??
        0
      const currentRightOverhang =
        cabinet.benchtopRightOverhang ??
        cabinet.carcass.config.benchtopRightOverhang ??
        0

      if (dimId === "benchtop:heightFromFloor") {
        const clampedValue = Math.max(0, Math.min(1200, value))
        const parentCabinet = cabinet.benchtopParentCabinetId
          ? cabinets.find(
              (cab) => cab.cabinetId === cabinet.benchtopParentCabinetId
            )
          : undefined

        if (parentCabinet) {
          const baseY =
            parentCabinet.group.position.y +
            parentCabinet.carcass.dimensions.height
          const heightDelta = clampedValue - baseY

          cabinet.manuallyEditedDelta = {
            ...cabinet.manuallyEditedDelta,
            height: heightDelta,
          }

          updateBenchtopPosition(parentCabinet, cabinets, {
            positionChanged: true,
          })
        } else {
          cabinet.benchtopHeightFromFloor = clampedValue
          cabinet.group.position.setY(clampedValue)
        }

        setSelectedCabinets((prev) => prev.map((cab) => ({ ...cab })))
        const actual = getBenchtopFormulaValue(cabinet, dimId) ?? clampedValue
        return { applied: true, actual }
      }

      if (dimId === "benchtop:thickness") {
        const clampedValue = Math.max(20, Math.min(60, value))
        cabinet.benchtopThickness = clampedValue
        cabinet.carcass.updateDimensions({
          width: cabinet.carcass.dimensions.width,
          height: clampedValue,
          depth: cabinet.carcass.dimensions.depth,
        })

        const parentCabinet = cabinet.benchtopParentCabinetId
          ? cabinets.find(
              (cab) => cab.cabinetId === cabinet.benchtopParentCabinetId
            )
          : undefined
        if (parentCabinet) {
          updateAllDependentComponents(parentCabinet, cabinets, wallDimensions, {
            widthChanged: true,
            heightChanged: true,
            depthChanged: true,
          })
        }

        setSelectedCabinets((prev) => prev.map((cab) => ({ ...cab })))
        return { applied: true, actual: clampedValue }
      }

      if (
        dimId === "benchtop:frontOverhang" ||
        dimId === "benchtop:leftOverhang" ||
        dimId === "benchtop:rightOverhang"
      ) {
        const clampedValue = Math.max(0, Math.min(100, value))
        const frontOverhang =
          dimId === "benchtop:frontOverhang"
            ? clampedValue
            : currentFrontOverhang
        const leftOverhang =
          dimId === "benchtop:leftOverhang"
            ? clampedValue
            : currentLeftOverhang
        const rightOverhang =
          dimId === "benchtop:rightOverhang"
            ? clampedValue
            : currentRightOverhang

        cabinet.benchtopFrontOverhang = frontOverhang
        cabinet.benchtopLeftOverhang = leftOverhang
        cabinet.benchtopRightOverhang = rightOverhang

        if (dimId === "benchtop:frontOverhang") {
          const parentCabinet = cabinet.benchtopParentCabinetId
            ? cabinets.find(
                (cab) => cab.cabinetId === cabinet.benchtopParentCabinetId
              )
            : undefined
          const parentDepth = parentCabinet?.carcass.dimensions.depth ?? 600
          cabinet.carcass.dimensions.depth =
            parentDepth + BENCHTOP_FIXED_DEPTH_EXTENSION + frontOverhang
        }

        cabinet.carcass.updateBenchtopOverhangs(
          frontOverhang,
          leftOverhang,
          rightOverhang
        )

        const parentCabinet = cabinet.benchtopParentCabinetId
          ? cabinets.find(
              (cab) => cab.cabinetId === cabinet.benchtopParentCabinetId
            )
          : undefined
        if (parentCabinet) {
          updateAllDependentComponents(parentCabinet, cabinets, wallDimensions, {
            widthChanged: true,
            heightChanged: true,
            depthChanged: true,
          })
        }

        setSelectedCabinets((prev) => prev.map((cab) => ({ ...cab })))
        const actual = getBenchtopFormulaValue(cabinet, dimId) ?? clampedValue
        return { applied: true, actual }
      }

      return { applied: false }
    },
    [cabinets, setSelectedCabinets, wallDimensions]
  )

  const applyFillerPanelFormulaValue = useCallback(
    (
      cabinet: CabinetData,
      dimId: string,
      value: number
    ): { applied: boolean; actual?: number } => {
      if (!isFillerPanelFormulaDimId(dimId)) {
        return { applied: false }
      }

      const currentY = cabinet.group.position.y
      const currentHeight = cabinet.carcass.dimensions.height
      const topPosition = currentY + currentHeight
      const parentCabinet = cabinet.parentCabinetId
        ? cabinets.find((cab) => cab.cabinetId === cabinet.parentCabinetId)
        : undefined

      if (parentCabinet) {
        cabinet.parentYOffset = value
      } else {
        cabinet.parentYOffset = undefined
      }

      const newY = parentCabinet
        ? parentCabinet.group.position.y + value
        : value
      const newHeight = topPosition - newY

      cabinet.group.position.set(
        cabinet.group.position.x,
        newY,
        cabinet.group.position.z
      )
      cabinet.carcass.updateDimensions({
        width: cabinet.carcass.dimensions.width,
        height: newHeight,
        depth: cabinet.carcass.dimensions.depth,
      })

      updateAllDependentComponents(cabinet, cabinets, wallDimensions, {
        positionChanged: true,
        heightChanged: true,
      })

      setSelectedCabinets((prev) => prev.map((cab) => ({ ...cab })))
      const actual = getFillerPanelFormulaValue(cabinet, dimId) ?? value
      return { applied: true, actual }
    },
    [cabinets, setSelectedCabinets, wallDimensions]
  )

  const applyProductFormulaUpdates = useCallback(
    (
      cabinet: CabinetData,
      updates: Record<string, number>,
      cached: any
    ): Record<string, number> => {
      const dims = cached?.product?.dims
      const threeJsGDs = cached?.threeJsGDs
      if (!dims || !threeJsGDs) return {}

      const gdMapping = getGDMapping(threeJsGDs)
      const dimsList = buildDimsList(dims)
      const dimIndex = new Map(dimsList)

      const dimsToApply: Partial<{
        width: number
        height: number
        depth: number
      }> = {}
      const remainingUpdates: Record<string, number> = {}

      Object.entries(updates).forEach(([dimId, value]) => {
        const dimObj = dimIndex.get(dimId)
        if (!dimObj) return
        const dimensionType = getDimensionTypeForEditing(dimObj, gdMapping)
        if (dimensionType) {
          dimsToApply[dimensionType] = value
          return
        }
        remainingUpdates[dimId] = value
      })

      if (Object.keys(dimsToApply).length > 0) {
        const nextDims = {
          width: cabinet.carcass.dimensions.width,
          height: cabinet.carcass.dimensions.height,
          depth: cabinet.carcass.dimensions.depth,
          ...dimsToApply,
        }
        handleProductDimensionChange(nextDims, {
          selectedCabinet: cabinet,
          selectedCabinets,
          cabinets,
          cabinetSyncs,
          cabinetGroups,
          viewManager,
          wallDimensions,
        })
      }

      Object.entries(remainingUpdates).forEach(([dimId, value]) => {
        const dimObj = dimIndex.get(dimId)
        if (!dimObj?.GDId) return

        if (gdMapping.doorOverhangGDIds.includes(dimObj.GDId)) {
          const nextValue = value >= 1
          cabinet.carcass.updateOverhangDoor(nextValue)
          updateAllDependentComponents(cabinet, cabinets, wallDimensions, {
            overhangChanged: true,
          })
          return
        }

        if (gdMapping.shelfQtyGDIds.includes(dimObj.GDId)) {
          cabinet.carcass.updateConfig({ shelfCount: Math.round(value) })
          return
        }

        if (gdMapping.drawerQtyGDIds.includes(dimObj.GDId)) {
          cabinet.carcass.updateDrawerQuantity(Math.max(0, Math.round(value)))
          setSelectedCabinets((prev) => prev.map((cab) => ({ ...cab })))
          return
        }

        if (gdMapping.doorQtyGDIds.includes(dimObj.GDId)) {
          cabinet.carcass.updateDoorConfiguration(
            Math.max(0, Math.round(value))
          )
          return
        }

        const drawerIndex = getDrawerHeightIndex(dimObj.GDId, gdMapping)
        if (drawerIndex !== null) {
          cabinet.carcass.updateDrawerHeight(drawerIndex, value, dimId)
          setSelectedCabinets((prev) => prev.map((cab) => ({ ...cab })))
        }
      })

      const appliedValues: Record<string, number> = {}

      Object.keys(updates).forEach((dimId) => {
        const dimObj = dimIndex.get(dimId)
        if (!dimObj) return
        const dimensionType = getDimensionTypeForEditing(dimObj, gdMapping)
        if (dimensionType === "width") {
          appliedValues[dimId] = cabinet.carcass.dimensions.width
          return
        }
        if (dimensionType === "height") {
          appliedValues[dimId] = cabinet.carcass.dimensions.height
          return
        }
        if (dimensionType === "depth") {
          appliedValues[dimId] = cabinet.carcass.dimensions.depth
          return
        }
        if (!dimObj.GDId) return
        if (gdMapping.doorOverhangGDIds.includes(dimObj.GDId)) {
          appliedValues[dimId] = cabinet.carcass.config.overhangDoor ? 1 : 0
          return
        }
        if (gdMapping.shelfQtyGDIds.includes(dimObj.GDId)) {
          appliedValues[dimId] = cabinet.carcass.config.shelfCount ?? 0
          return
        }
        if (gdMapping.drawerQtyGDIds.includes(dimObj.GDId)) {
          appliedValues[dimId] = cabinet.carcass.config.drawerQuantity ?? 0
          return
        }
        if (gdMapping.doorQtyGDIds.includes(dimObj.GDId)) {
          appliedValues[dimId] = cabinet.carcass.config.doorCount ?? 0
          return
        }
        const drawerIndex = getDrawerHeightIndex(dimObj.GDId, gdMapping)
        if (drawerIndex !== null) {
          const height =
            cabinet.carcass.config.drawerHeights?.[drawerIndex] ?? 0
          appliedValues[dimId] = height
        }
      })

      return appliedValues
    },
    [
      cabinets,
      cabinetGroups,
      cabinetSyncs,
      selectedCabinets,
      setSelectedCabinets,
      viewManager,
      wallDimensions,
    ]
  )

  const recalcFormulas = useCallback(() => {
    if (isApplyingRef.current) return
    isApplyingRef.current = true
    let anyApplied = false
    const appliedCabinets: string[] = []

    try {
      for (let pass = 0; pass < MAX_PASSES; pass += 1) {
        let passApplied = false
        const scope = {
          cab: (cabinetId: string, field: string) =>
            getCabinetField(cabinetId, field) ?? 0,
          dim: (cabinetId: string, dimId: string) =>
            getCabinetDimValue(cabinetId, dimId) ?? 0,
        }

        cabinets.forEach((cabinet) => {
          const persisted = getPersistedState(cabinet.cabinetId)
          const formulas = persisted?.formulas
          if (!formulas) return

          const updates: Record<string, number> = {}
          Object.entries(formulas).forEach(([dimId, formula]) => {
            if (!formula || formula.trim() === "") return
            let result: number | null = null
            try {
              result = normalizeResult(evaluate(formula, scope))
            } catch (error) {
              console.warn("[formulaEngine] Invalid formula:", formula, error)
              return
            }
            if (!isFiniteNumber(result)) return

            const current =
              cabinet.cabinetType === "appliance"
                ? getApplianceFormulaValue(cabinet, dimId)
                : getCabinetDimValue(cabinet.cabinetId, dimId)
            if (
              isFiniteNumber(current) &&
              Math.abs(result - current) < EPSILON
            ) {
              return
            }
            updates[dimId] = result
          })

          if (Object.keys(updates).length === 0) return

          const currentState = ensurePersistedState(cabinet)

          if (cabinet.cabinetType === "appliance") {
            const appliedValues: Record<string, number> = {}
            Object.entries(updates).forEach(([dimId, value]) => {
              const result = applyApplianceFormulaValue(cabinet, dimId, value)
              if (result.applied && isFiniteNumber(result.actual)) {
                appliedValues[dimId] = result.actual
              }
            })

            if (Object.keys(appliedValues).length > 0) {
              if (isDev) {
                console.log("[formulaEngine] Applied appliance formulas", {
                  cabinetId: cabinet.cabinetId,
                  values: appliedValues,
                })
              }
              const nextValues = { ...currentState.values, ...appliedValues }
              setPersistedState(cabinet.cabinetId, {
                ...currentState,
                values: nextValues,
              })
              passApplied = true
              appliedCabinets.push(cabinet.cabinetId)
            }
            return
          }

          const isBenchtop = cabinet.cabinetType === "benchtop"
          const isFillerPanel =
            cabinet.cabinetType === "filler" || cabinet.cabinetType === "panel"
          const cached = getProductDataCached(cabinet.productId)
          let appliedValues: Record<string, number> = {}

          if (isBenchtop || isFillerPanel) {
            const customUpdates: Record<string, number> = {}
            const remainingUpdates: Record<string, number> = {}

            Object.entries(updates).forEach(([dimId, value]) => {
              if (isBenchtop && BENCHTOP_FORMULA_DIM_ID_SET.has(dimId as BenchtopFormulaDimId)) {
                customUpdates[dimId] = value
                return
              }
              if (isFillerPanel && FILLER_PANEL_FORMULA_DIM_ID_SET.has(dimId as FillerPanelFormulaDimId)) {
                customUpdates[dimId] = value
                return
              }
              remainingUpdates[dimId] = value
            })

            if (Object.keys(remainingUpdates).length > 0) {
              appliedValues = applyProductFormulaUpdates(
                cabinet,
                remainingUpdates,
                cached
              )
            }

            const customApplied: Record<string, number> = {}

            if (isBenchtop) {
              Object.entries(customUpdates).forEach(([dimId, value]) => {
                const result = applyBenchtopFormulaValue(
                  cabinet,
                  dimId,
                  value
                )
                if (result.applied && isFiniteNumber(result.actual)) {
                  customApplied[dimId] = result.actual
                }
              })
            }

            if (isFillerPanel) {
              Object.entries(customUpdates).forEach(([dimId, value]) => {
                const result = applyFillerPanelFormulaValue(
                  cabinet,
                  dimId,
                  value
                )
                if (result.applied && isFiniteNumber(result.actual)) {
                  customApplied[dimId] = result.actual
                }
              })
            }

            appliedValues = { ...appliedValues, ...customApplied }
          } else {
            appliedValues = applyProductFormulaUpdates(cabinet, updates, cached)
          }

          if (Object.keys(appliedValues).length > 0) {
            if (isDev) {
              console.log("[formulaEngine] Applied cabinet formulas", {
                cabinetId: cabinet.cabinetId,
                values: appliedValues,
              })
            }
            const nextValues = { ...currentState.values, ...appliedValues }
            setPersistedState(cabinet.cabinetId, {
              ...currentState,
              values: nextValues,
            })
            passApplied = true
            appliedCabinets.push(cabinet.cabinetId)
          }
        })

        if (!passApplied) break
        anyApplied = true
      }
    } catch (error) {
      console.warn("[formulaEngine] Failed to apply formulas:", error)
    } finally {
      isApplyingRef.current = false
    }

    if (anyApplied) {
      appliedCabinets.forEach((cabinetId) => {
        lastEvaluatedAtRef.current.set(cabinetId, Date.now())
      })
      if (appliedCabinets.length > 0) {
        setLastEvaluatedVersion((v) => v + 1)
      }
      onFormulasApplied?.()
    }
  }, [
    cabinets,
    getCabinetDimValue,
    getCabinetField,
    getProductDataCached,
    applyApplianceFormulaValue,
    applyBenchtopFormulaValue,
    applyFillerPanelFormulaValue,
    applyProductFormulaUpdates,
    onFormulasApplied,
  ])

  recalcRef.current = recalcFormulas

  const getFormulaLastEvaluatedAt = useCallback(
    (cabinetId: string) => lastEvaluatedAtRef.current.get(cabinetId),
    [lastEvaluatedVersion]
  )

  useEffect(() => {
    return () => {
      scheduleFormulaRecalc.cancel()
    }
  }, [scheduleFormulaRecalc])

  return {
    formulaPieces,
    getFormula,
    setFormula,
    scheduleFormulaRecalc,
    getFormulaLastEvaluatedAt,
  }
}
