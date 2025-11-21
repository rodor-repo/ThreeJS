import { useCallback, useEffect, useState } from "react"
import * as THREE from "three"
import { createCabinet as createCabinetEntry } from "../factory/cabinetFactory"
import {
  clearHighlight,
  highlightSelected,
  pulseHover,
  unpulseHover,
} from "../../scene/lib/selection"
import type { CabinetData } from "../../scene/types"
import type { CabinetType } from "@/features/carcass"
import { cabinetPanelState } from "../ui/ProductPanel"

export const useCabinets = (
  sceneRef: React.MutableRefObject<THREE.Scene | null>
) => {
  const [cabinets, setCabinets] = useState<CabinetData[]>([])
  const [cabinetCounter, setCabinetCounter] = useState(0)
  const [sortNumberCounter, setSortNumberCounter] = useState(1) // Track order cabinets are added
  const [selectedCabinet, setSelectedCabinet] = useState<CabinetData | null>(
    null
  )
  const [showProductPanel, setShowProductPanel] = useState(false)

  const createCabinet = useCallback(
    (
      categoryType: CabinetType,
      subcategoryType: string,
      productId?: string
    ) => {
      if (!sceneRef.current) return
      const data = createCabinetEntry(categoryType, subcategoryType, {
        indexOffset: cabinetCounter,
        productId,
      })
      // Add sortNumber based on order added to scene
      const cabinetWithSortNumber = { ...data, sortNumber: sortNumberCounter }
      sceneRef.current.add(cabinetWithSortNumber.group)
      setCabinets((prev) => [...prev, cabinetWithSortNumber])
      setCabinetCounter((prev) => prev + 1)
      setSortNumberCounter((prev) => prev + 1)
      return cabinetWithSortNumber
    },
    [sceneRef, cabinetCounter, sortNumberCounter]
  )

  const clearCabinets = useCallback(() => {
    if (!sceneRef.current) return
    cabinets.forEach((c) => sceneRef.current!.remove(c.group))
    setCabinets([])
    setCabinetCounter(0)
    setSortNumberCounter(1) // Reset sort number counter
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

  const updateCabinetViewId = useCallback(
    (cabinetId: string, viewId: string | undefined) => {
      setCabinets((prev) =>
        prev.map((cab) =>
          cab.cabinetId === cabinetId ? { ...cab, viewId } : cab
        )
      )
      if (selectedCabinet?.cabinetId === cabinetId) {
        setSelectedCabinet({ ...selectedCabinet, viewId })
      }
    },
    [selectedCabinet, setSelectedCabinet]
  )

  const updateCabinetLock = useCallback(
    (cabinetId: string, leftLock: boolean, rightLock: boolean) => {
      setCabinets((prev) =>
        prev.map((cab) =>
          cab.cabinetId === cabinetId ? { ...cab, leftLock, rightLock } : cab
        )
      )
      if (selectedCabinet?.cabinetId === cabinetId) {
        setSelectedCabinet({ ...selectedCabinet, leftLock, rightLock })
      }
    },
    [selectedCabinet]
  )

  const deleteCabinet = useCallback(
    (cabinetId: string) => {
      if (!sceneRef.current) return
      
      const cabinetToDelete = cabinets.find(c => c.cabinetId === cabinetId)
      if (!cabinetToDelete) return

      // Remove from scene
      sceneRef.current.remove(cabinetToDelete.group)
      
      // Dispose of geometry and materials
      cabinetToDelete.group.traverse((child) => {
        const anyChild = child as any
        if (anyChild.geometry) anyChild.geometry.dispose()
        if (anyChild.material) {
          if (Array.isArray(anyChild.material)) {
            anyChild.material.forEach((m: THREE.Material) => m.dispose())
          } else {
            (anyChild.material as THREE.Material).dispose()
          }
        }
      })

      // Calculate renumbered cabinets before updating state
      const remainingCabinets = cabinets.filter(c => c.cabinetId !== cabinetId)
      
      // Sort remaining cabinets by their current sortNumber
      const sortedCabinets = [...remainingCabinets].sort((a, b) => {
        const aNum = a.sortNumber ?? 0
        const bNum = b.sortNumber ?? 0
        return aNum - bNum
      })
      
      // Reassign sequential sortNumbers starting from 1
      const renumberedCabinets = sortedCabinets.map((cab, index) => ({
        ...cab,
        sortNumber: index + 1
      }))
      
      // Update sortNumberCounter to be the next number after the highest sortNumber
      const maxSortNumber = renumberedCabinets.length > 0 
        ? Math.max(...renumberedCabinets.map(c => c.sortNumber ?? 0))
        : 0
      setSortNumberCounter(maxSortNumber + 1)
      
      // Update cabinets state
      setCabinets(renumberedCabinets)
      
      // Update selectedCabinet if it was renumbered (but not deleted)
      if (selectedCabinet && selectedCabinet.cabinetId !== cabinetId) {
        const updatedSelected = renumberedCabinets.find(c => c.cabinetId === selectedCabinet.cabinetId)
        if (updatedSelected) {
          setSelectedCabinet(updatedSelected)
        }
      }
      
      // Clean up cabinet panel state
      cabinetPanelState.delete(cabinetId)
      
      // Clear selection if this cabinet was selected
      if (selectedCabinet?.cabinetId === cabinetId) {
        setSelectedCabinet(null)
        setShowProductPanel(false)
      }
    },
    [sceneRef, cabinets, selectedCabinet]
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
    updateCabinetViewId,
    updateCabinetLock,
    deleteCabinet,
  }
}
