import { useEffect, useMemo, useRef, useState } from "react"
import { categoriesData } from "@/components/categoriesData"
import type { Group } from "three"
import type { CarcassDimensions, CarcassMaterialData } from "@/features/carcass"
import type {
  ProductPanelCallbacks,
  SelectedCabinetSnapshot,
  DimensionConstraints,
} from "../ui/product-panel.types"

export type UseProductPanelStateArgs = {
  selectedCabinet?: SelectedCabinetSnapshot | null
} & ProductPanelCallbacks

export const useProductPanelState = ({
  selectedCabinet,
  onDimensionsChange,
  onMaterialChange,
  onKickerHeightChange,
  onDoorToggle,
  onDoorMaterialChange,
  onDoorCountChange,
  onOverhangDoorToggle,
  onDrawerToggle,
  onDrawerQuantityChange,
  onDrawerHeightChange,
  onDrawerHeightsBalance,
  onDrawerHeightsReset,
  onDebugBalanceTest,
}: UseProductPanelStateArgs) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const [dimensions, setDimensions] = useState<CarcassDimensions>({
    width: 600,
    height: 600,
    depth: 300,
  })
  const [materialColor, setMaterialColor] = useState("#ffffff")
  const [materialThickness, setMaterialThickness] = useState(16)
  const [kickerHeight, setKickerHeight] = useState(100)
  const [doorEnabled, setDoorEnabled] = useState(true)
  const [doorColor, setDoorColor] = useState("#ffffff")
  const [doorThickness, setDoorThickness] = useState(18)
  const [doorCount, setDoorCount] = useState(2)
  const [doorCountAutoAdjusted, setDoorCountAutoAdjusted] = useState(false)
  const [overhangDoor, setOverhangDoor] = useState(true)
  const [drawerEnabled, setDrawerEnabled] = useState(false)
  const [drawerQuantity, setDrawerQuantity] = useState(3)
  const [drawerHeights, setDrawerHeights] = useState<number[]>([])
  const [isEditingDrawerHeights, setIsEditingDrawerHeights] = useState(false)
  const [isEditingDimensions, setIsEditingDimensions] = useState(false)

  const lastSyncedCabinetRef = useRef<Group | null>(null)
  const previousCabinetHeightRef = useRef<number>(600)

  const isOneDoorAllowed = () => dimensions.width <= 600
  const isDrawerCabinet = () => selectedCabinet?.subcategoryId === "drawer"

  const handleDrawerToggle = (enabled: boolean) => {
    setDrawerEnabled(enabled)
    onDrawerToggle?.(enabled)
  }

  const recalculateDrawerHeights = () => {
    if (drawerEnabled && drawerQuantity > 0) {
      const proportionalHeight =
        Math.round((dimensions.height / drawerQuantity) * 10) / 10
      const newDrawerHeights = Array(drawerQuantity).fill(proportionalHeight)
      setDrawerHeights(newDrawerHeights)
      newDrawerHeights.forEach((height, index) =>
        onDrawerHeightChange?.(index, height)
      )
    }
  }

  const balanceRemainingDrawerHeights = (
    changedIndex: number,
    newHeight: number
  ) => {
    if (!drawerEnabled || drawerQuantity <= 1) return
    const newDrawerHeights = [...drawerHeights]
    newDrawerHeights[changedIndex] = newHeight
    const usedHeight = newDrawerHeights.reduce((sum, h) => sum + (h || 0), 0)
    const remainingHeight = dimensions.height - usedHeight
    if (remainingHeight > 0) {
      const remainingDrawers = drawerQuantity - 1
      if (remainingDrawers > 0) {
        const heightPerRemainingDrawer =
          Math.round((remainingHeight / remainingDrawers) * 10) / 10
        for (let i = 0; i < drawerQuantity; i++)
          if (i !== changedIndex)
            newDrawerHeights[i] = Math.max(50, heightPerRemainingDrawer)
      }
    }
    setDrawerHeights(newDrawerHeights)
    return newDrawerHeights
  }

  // Debug helper mirrors the old "Debug Balance" behavior: tries a balance pass and logs it
  const debugBalanceTest = () => {
    try {
      if (!drawerEnabled || drawerQuantity <= 0) return
      const testIndex = 0
      const testHeight = Math.min(
        dimensions.height,
        Math.max(50, Math.round(dimensions.height * 0.4 * 10) / 10)
      )
      const result = balanceRemainingDrawerHeights(testIndex, testHeight)
      // propagate to callbacks so the carcass reflects the previewed values
      if (result) result.forEach((h, i) => onDrawerHeightChange?.(i, h))
      const payload = result || []
      console.log("Debug: Balance result:", payload)
      onDebugBalanceTest?.()
      return payload
    } catch (e) {
      console.warn("DebugBalanceTest failed", e)
    }
  }

  const scaleDrawerHeightsProportionally = (
    oldHeight: number,
    newHeight: number
  ) => {
    if (!drawerEnabled || drawerQuantity <= 0 || drawerHeights.length === 0)
      return
    const scaleRatio = newHeight / oldHeight
    const newDrawerHeights = drawerHeights.map(
      (h) => Math.round(h * scaleRatio * 10) / 10
    )
    const totalNewHeight = newDrawerHeights.reduce((s, h) => s + h, 0)
    if (totalNewHeight > newHeight) recalculateDrawerHeights()
    else {
      setDrawerHeights(newDrawerHeights)
      newDrawerHeights.forEach((h, i) => onDrawerHeightChange?.(i, h))
    }
  }

  const handleDrawerQuantityChange = (quantity: number) => {
    setDrawerQuantity(quantity)
    const proportionalHeight =
      Math.round((dimensions.height / quantity) * 10) / 10
    const newDrawerHeights = Array(quantity).fill(proportionalHeight)
    setDrawerHeights(newDrawerHeights)
    onDrawerQuantityChange?.(quantity)
  }

  useEffect(() => {
    if (drawerEnabled && drawerQuantity > 0 && drawerHeights.length === 0) {
      const proportionalHeight =
        Math.round((dimensions.height / drawerQuantity) * 10) / 10
      const initial = Array(drawerQuantity).fill(proportionalHeight)
      setDrawerHeights(initial)
    }
  }, [drawerEnabled, drawerQuantity, dimensions.height, drawerHeights.length])

  const handleDrawerHeightChange = (index: number, height: number) => {
    const roundedHeight = Math.round(height * 10) / 10
    setIsEditingDrawerHeights(true)
    const balancedHeights = balanceRemainingDrawerHeights(index, roundedHeight)
    if (balancedHeights) {
      onDrawerHeightChange?.(index, roundedHeight)
      balancedHeights.forEach((h, i) => {
        if (i !== index) onDrawerHeightChange?.(i, h)
      })
    }
    setTimeout(() => setIsEditingDrawerHeights(false), 500)
  }

  const updateDrawerHeightLocal = (index: number, value: number) => {
    const next = [...drawerHeights]
    next[index] = value
    setDrawerHeights(next)
  }

  const getDimensionConstraints = (
    subcategoryId?: string
  ): DimensionConstraints => {
    if (!subcategoryId)
      return {
        height: { min: 300, max: 3000, default: 720 },
        width: { min: 200, max: 1200, default: 600 },
        depth: { min: 200, max: 800, default: 600 },
      }
    for (const category of categoriesData.categories) {
      const sub = category.subcategories.find((s) => s.id === subcategoryId)
      if (sub) return sub.dimensions
    }
    return {
      height: { min: 300, max: 3000, default: 720 },
      width: { min: 200, max: 1200, default: 600 },
      depth: { min: 200, max: 800, default: 600 },
    }
  }

  const dimensionConstraints = useMemo(
    () => getDimensionConstraints(selectedCabinet?.subcategoryId),
    [selectedCabinet?.subcategoryId]
  )

  useEffect(() => {
    if (isEditingDrawerHeights) return
    if (
      selectedCabinet &&
      selectedCabinet.drawerHeights &&
      selectedCabinet.drawerHeights.length > 0
    ) {
      if (drawerHeights.length === selectedCabinet.drawerHeights.length) {
        const hasChanges = selectedCabinet.drawerHeights.some(
          (h, i) => Math.abs((drawerHeights[i] || 0) - h) > 0.1
        )
        if (hasChanges) setDrawerHeights([...selectedCabinet.drawerHeights])
      } else if (drawerHeights.length === 0)
        setDrawerHeights([...selectedCabinet.drawerHeights])
    }
  }, [selectedCabinet?.drawerHeights, isEditingDrawerHeights])

  useEffect(() => {
    if (isEditingDimensions) return
    if (selectedCabinet) {
      const isNewCabinet =
        lastSyncedCabinetRef.current !== selectedCabinet.group
      if (isNewCabinet) {
        const constraints = getDimensionConstraints(
          selectedCabinet.subcategoryId
        )
        const initialDimensions = {
          height:
            selectedCabinet.dimensions.height || constraints.height.default,
          width: selectedCabinet.dimensions.width || constraints.width.default,
          depth: selectedCabinet.dimensions.depth || constraints.depth.default,
        }
        setDimensions(initialDimensions)
        previousCabinetHeightRef.current = initialDimensions.height
        setMaterialColor(selectedCabinet.material.getColour())
        setMaterialThickness(selectedCabinet.material.getPanelThickness())
        if (
          selectedCabinet.cabinetType === "base" ||
          selectedCabinet.cabinetType === "tall"
        ) {
          const currentKickerHeight = categoriesData.legSettings?.default || 100
          setKickerHeight(currentKickerHeight)
        }
        setDoorEnabled(selectedCabinet.doorEnabled || false)
        setDoorColor(selectedCabinet.doorMaterial?.getColour() || "#ffffff")
        setDoorThickness(selectedCabinet.doorMaterial?.getThickness() || 18)
        setDoorCount(selectedCabinet.doorCount || 2)
        setOverhangDoor(selectedCabinet.overhangDoor || false)
        setDrawerEnabled(selectedCabinet.drawerEnabled || false)
        setDrawerQuantity(selectedCabinet.drawerQuantity || 3)
        if (drawerHeights.length === 0) {
          if (
            selectedCabinet.drawerHeights &&
            selectedCabinet.drawerHeights.length > 0
          )
            setDrawerHeights([...selectedCabinet.drawerHeights])
          else {
            const defaultHeight =
              Math.round(
                (initialDimensions.height /
                  (selectedCabinet.drawerQuantity || 3)) *
                  10
              ) / 10
            const newDrawerHeights = Array(
              selectedCabinet.drawerQuantity || 3
            ).fill(defaultHeight)
            setDrawerHeights(newDrawerHeights)
          }
        }
        lastSyncedCabinetRef.current = selectedCabinet.group
      }
    }
  }, [selectedCabinet, isEditingDimensions])

  useEffect(() => {
    if (drawerEnabled && drawerQuantity > 0 && !isEditingDrawerHeights) {
      if (drawerHeights.length > 0 && drawerHeights.some((h) => h > 0))
        scaleDrawerHeightsProportionally(
          previousCabinetHeightRef.current,
          dimensions.height
        )
      else recalculateDrawerHeights()
      previousCabinetHeightRef.current = dimensions.height
    }
  }, [dimensions.height, drawerEnabled, drawerQuantity])

  const handleDimensionChange = (
    field: keyof CarcassDimensions,
    value: number
  ) => {
    setIsEditingDimensions(true)
    const constraints = getDimensionConstraints(selectedCabinet?.subcategoryId)
    if (value < constraints[field].min || value > constraints[field].max) {
      alert(
        `${field.charAt(0).toUpperCase() + field.slice(1)} must be between ${
          constraints[field].min
        }mm and ${constraints[field].max}mm`
      )
      setIsEditingDimensions(false)
      return
    }
    const newDimensions = { ...dimensions, [field]: value }
    setDimensions(newDimensions)
    if (field === "width" && doorEnabled) {
      if (value > 600 && doorCount === 1) {
        setDoorCount(2)
        setDoorCountAutoAdjusted(true)
        if (onDoorCountChange && selectedCabinet) onDoorCountChange(2)
      } else if (value <= 600 && doorCount === 2)
        setDoorCountAutoAdjusted(false)
    }
    if (onDimensionsChange && selectedCabinet) onDimensionsChange(newDimensions)
    setTimeout(() => setIsEditingDimensions(false), 500)
  }

  const handleMaterialChange = (
    field: "colour" | "panelThickness",
    value: string | number
  ) => {
    if (field === "colour") {
      setMaterialColor(value as string)
      if (onMaterialChange && selectedCabinet)
        onMaterialChange({ colour: value as string })
    } else if (field === "panelThickness") {
      const thickness = value as number
      if (thickness < 6 || thickness > 50) {
        alert("Material thickness must be between 6mm and 50mm")
        return
      }
      setMaterialThickness(thickness)
      if (onMaterialChange && selectedCabinet) {
        onMaterialChange({
          panelThickness: thickness,
          backThickness: thickness,
        } as Partial<CarcassMaterialData>)
      }
    }
  }

  const handleKickerHeightChange = (value: number) => {
    if (value < 50 || value > 200) {
      alert("Kicker height must be between 50mm and 200mm")
      return
    }
    setKickerHeight(value)
    if (onKickerHeightChange && selectedCabinet) onKickerHeightChange(value)
  }

  const handleDoorToggle = (enabled: boolean) => {
    setDoorEnabled(enabled)
    if (onDoorToggle && selectedCabinet) onDoorToggle(enabled)
  }

  const handleOverhangDoorToggle = (enabled: boolean) => {
    setOverhangDoor(enabled)
    if (onOverhangDoorToggle && selectedCabinet) onOverhangDoorToggle(enabled)
  }

  const handleDoorMaterialChange = (
    field: "colour" | "thickness",
    value: string | number
  ) => {
    if (field === "colour") setDoorColor(value as string)
    else if (field === "thickness") setDoorThickness(value as number)
    if (onDoorMaterialChange && selectedCabinet)
      onDoorMaterialChange({ [field]: value })
  }

  const handleDoorCountChange = (count: number) => {
    setDoorCount(count)
    if (onDoorCountChange && selectedCabinet) onDoorCountChange(count)
  }

  return {
    // state
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
    isEditingDrawerHeights,
    isEditingDimensions,
    // derived/helpers
    isOneDoorAllowed,
    isDrawerCabinet,
    dimensionConstraints,
    // handlers
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
    recalculateDrawerHeights,
    onDrawerHeightsBalance,
    onDrawerHeightsReset,
    setIsEditingDrawerHeights,
    setIsEditingDimensions,
    updateDrawerHeightLocal,
    debugBalanceTest,
  }
}
