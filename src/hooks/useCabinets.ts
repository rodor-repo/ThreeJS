import { useCallback, useEffect, useState } from "react"
import * as THREE from "three"
import { createCabinet as createCabinetEntry } from "../components/three/cabinet-factory"
import {
  clearHighlight,
  highlightSelected,
  pulseHover,
  unpulseHover,
} from "../components/three/selection"
import type { CabinetData } from "../components/three/types"
import type { CabinetType } from "../components/Carcass"

export const useCabinets = (
  sceneRef: React.MutableRefObject<THREE.Scene | null>
) => {
  const [cabinets, setCabinets] = useState<CabinetData[]>([])
  const [cabinetCounter, setCabinetCounter] = useState(0)
  const [selectedCabinet, setSelectedCabinet] = useState<CabinetData | null>(
    null
  )
  const [showProductPanel, setShowProductPanel] = useState(false)

  const createCabinet = useCallback(
    (categoryType: CabinetType, subcategoryType: string) => {
      if (!sceneRef.current) return
      const data = createCabinetEntry(categoryType, subcategoryType, {
        indexOffset: cabinetCounter,
      })
      sceneRef.current.add(data.group)
      setCabinets((prev) => [...prev, data])
      setCabinetCounter((prev) => prev + 1)
    },
    [sceneRef, cabinetCounter]
  )

  const clearCabinets = useCallback(() => {
    if (!sceneRef.current) return
    cabinets.forEach((c) => sceneRef.current!.remove(c.group))
    setCabinets([])
    setCabinetCounter(0)
    setSelectedCabinet(null)
    setShowProductPanel(false)
  }, [sceneRef, cabinets])

  useEffect(() => {
    cabinets.forEach((c) => clearHighlight(c.group))
    if (selectedCabinet) highlightSelected(selectedCabinet.group)
  }, [selectedCabinet, cabinets])

  const addHoverEffect = useCallback(
    (cab: CabinetData) => {
      if (cab === selectedCabinet) pulseHover(cab.group)
    },
    [selectedCabinet]
  )

  const removeHoverEffect = useCallback(
    (cab: CabinetData) => {
      if (cab === selectedCabinet) unpulseHover(cab.group)
    },
    [selectedCabinet]
  )

  return {
    cabinets,
    cabinetCounter,
    selectedCabinet,
    setSelectedCabinet,
    showProductPanel,
    setShowProductPanel,
    createCabinet,
    clearCabinets,
    addHoverEffect,
    removeHoverEffect,
  }
}
