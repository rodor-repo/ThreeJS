import { useCallback, useEffect, useState, Dispatch, SetStateAction } from "react"
import * as THREE from "three"
import { createCabinet as createCabinetEntry } from "../factory/cabinetFactory"
import {
  clearHighlight,
  highlightSelected,
  pulseHover,
  unpulseHover,
} from "../../scene/lib/selection"
import type { CabinetData } from "../../scene/types"
import type { CabinetType, CarcassDimensions } from "@/features/carcass"
import { cabinetPanelState } from "../ui/ProductPanel"

/** Additional properties to merge into the created CabinetData */
type AdditionalCabinetProps = Partial<Omit<CabinetData, 'group' | 'carcass' | 'cabinetType' | 'subcategoryId' | 'cabinetId'>>

export const useCabinets = (
  sceneRef: React.MutableRefObject<THREE.Scene | null>
) => {
  const [cabinets, setCabinets] = useState<CabinetData[]>([])
  const [cabinetCounter, setCabinetCounter] = useState(0)
  const [sortNumberCounter, setSortNumberCounter] = useState(1) // Track order cabinets are added
  const [selectedCabinets, setSelectedCabinets] = useState<CabinetData[]>([])
  const [showProductPanel, setShowProductPanel] = useState(false)
  
  // Backward compatibility: selectedCabinet is the first selected cabinet
  const selectedCabinet = selectedCabinets.length > 0 ? selectedCabinets[0] : null
  const setSelectedCabinet = useCallback((cabinet: CabinetData | null) => {
    setSelectedCabinets(cabinet ? [cabinet] : [])
  }, [])
  
  // Type-safe wrapper for setSelectedCabinets that accepts both values and updater functions
  const setSelectedCabinetsWrapper: Dispatch<SetStateAction<CabinetData[]>> = setSelectedCabinets

  const createCabinet = useCallback(
    (
      categoryType: CabinetType,
      subcategoryType: string,
      options?: {
        productId?: string
        productName?: string
        fillerReturnPosition?: "left" | "right"
        customDimensions?: Partial<CarcassDimensions>
        additionalProps?: AdditionalCabinetProps
      }
    ) => {
      if (!sceneRef.current) return

      const { productId, productName, fillerReturnPosition, customDimensions, additionalProps } = options || {}

      const fillerType =
        categoryType === "filler"
          ? productName?.toLowerCase().includes("l shape") ? "l-shape" : "linear"
          : undefined

      const data = createCabinetEntry(categoryType, subcategoryType, {
        indexOffset: cabinetCounter,
        productId,
        fillerType,
        fillerReturnPosition,
        customDimensions
      })
      // Add sortNumber based on order added to scene, plus any additional properties
      const cabinetWithProps: CabinetData = { 
        ...data, 
        sortNumber: sortNumberCounter,
        ...additionalProps
      }
      sceneRef.current.add(cabinetWithProps.group)
      setCabinets((prev) => [...prev, cabinetWithProps])
      setCabinetCounter((prev) => prev + 1)
      setSortNumberCounter((prev) => prev + 1)
      return cabinetWithProps
    },
    [sceneRef, cabinetCounter, sortNumberCounter]
  )

  const clearCabinets = useCallback(() => {
    if (!sceneRef.current) return
    
    // Properly dispose of each cabinet's resources
    cabinets.forEach((c) => {
      // Remove from scene
      sceneRef.current!.remove(c.group)
      
      // Dispose of geometry and materials to free GPU memory
      c.group.traverse((child) => {
        const anyChild = child as any
        if (anyChild.geometry) {
          anyChild.geometry.dispose()
        }
        if (anyChild.material) {
          if (Array.isArray(anyChild.material)) {
            anyChild.material.forEach((m: THREE.Material) => m.dispose())
          } else {
            (anyChild.material as THREE.Material).dispose()
          }
        }
      })
      
      // Clean up cabinet panel state
      cabinetPanelState.delete(c.cabinetId)
    })
    
    setCabinets([])
    setCabinetCounter(0)
    setSortNumberCounter(1) // Reset sort number counter
    setSelectedCabinets([])
    setShowProductPanel(false)
  }, [sceneRef, cabinets])

  useEffect(() => {
    cabinets.forEach((c) => clearHighlight(c.group))
    // Highlight all selected cabinets
    selectedCabinets.forEach((cab) => highlightSelected(cab.group))
  }, [selectedCabinets, cabinets])

  const addHoverEffect = useCallback(
    (cab: CabinetData) => {
      if (selectedCabinets.includes(cab)) pulseHover(cab.group)
    },
    [selectedCabinets]
  )

  const removeHoverEffect = useCallback(
    (cab: CabinetData) => {
      if (selectedCabinets.includes(cab)) unpulseHover(cab.group)
    },
    [selectedCabinets]
  )

  const updateCabinetViewId = useCallback(
    (cabinetId: string, viewId: string | undefined) => {
      setCabinets((prev) => {
        // Find all child cabinets (fillers/panels) that belong to this parent
        const childCabinetIds = prev
          .filter(
            (cab) =>
              cab.parentCabinetId === cabinetId &&
              (cab.cabinetType === 'filler' || cab.cabinetType === 'panel')
          )
          .map((cab) => cab.cabinetId)

        // Find all kickers that belong to this parent
        const kickerCabinetIds = prev
          .filter(
            (cab) =>
              cab.kickerParentCabinetId === cabinetId &&
              cab.cabinetType === 'kicker'
          )
          .map((cab) => cab.cabinetId)

        // Update parent cabinet and all its children (fillers/panels and kickers)
        return prev.map((cab) => {
          if (cab.cabinetId === cabinetId) {
            // Update parent cabinet
            return { ...cab, viewId }
          } else if (childCabinetIds.includes(cab.cabinetId)) {
            // Update child fillers/panels to match parent's viewId
            return { ...cab, viewId }
          } else if (kickerCabinetIds.includes(cab.cabinetId)) {
            // Update kickers to match parent's viewId
            return { ...cab, viewId }
          }
          return cab
        })
      })
      // Update selected cabinets if they were modified
      setSelectedCabinets((prev) => {
        // Find child cabinet IDs from selected cabinets
        const childCabinetIds = prev
          .filter(
            (cab) =>
              cab.parentCabinetId === cabinetId &&
              (cab.cabinetType === 'filler' || cab.cabinetType === 'panel')
          )
          .map((cab) => cab.cabinetId)

        // Find kicker cabinet IDs from selected cabinets
        const kickerCabinetIds = prev
          .filter(
            (cab) =>
              cab.kickerParentCabinetId === cabinetId &&
              cab.cabinetType === 'kicker'
          )
          .map((cab) => cab.cabinetId)

        return prev.map((cab) => {
          if (cab.cabinetId === cabinetId) {
            return { ...cab, viewId }
          } else if (childCabinetIds.includes(cab.cabinetId)) {
            return { ...cab, viewId }
          } else if (kickerCabinetIds.includes(cab.cabinetId)) {
            return { ...cab, viewId }
          }
          return cab
        })
      })
    },
    []
  )

  const updateCabinetLock = useCallback(
    (cabinetId: string, leftLock: boolean, rightLock: boolean) => {
      setCabinets((prev) =>
        prev.map((cab) =>
          cab.cabinetId === cabinetId ? { ...cab, leftLock, rightLock } : cab
        )
      )
      // Update selected cabinets if they were modified
      setSelectedCabinets((prev) =>
        prev.map((cab) =>
          cab.cabinetId === cabinetId ? { ...cab, leftLock, rightLock } : cab
        )
      )
    },
    []
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
      
      // Update selected cabinets if they were renumbered (but not deleted)
      setSelectedCabinets((prev) => {
        const updated = prev
          .filter(c => c.cabinetId !== cabinetId) // Remove deleted cabinet
          .map(c => {
            const updatedCab = renumberedCabinets.find(rc => rc.cabinetId === c.cabinetId)
            return updatedCab || c
          })
        return updated
      })
      
      // Clean up cabinet panel state
      cabinetPanelState.delete(cabinetId)
      
      // Close panel if deleted cabinet was the only selected one
      if (selectedCabinets.length === 1 && selectedCabinets[0]?.cabinetId === cabinetId) {
        setShowProductPanel(false)
      }
    },
    [sceneRef, cabinets, selectedCabinets]
  )

  return {
    cabinets,
    cabinetCounter,
    selectedCabinet, // Backward compatibility: first selected cabinet
    selectedCabinets, // New: array of all selected cabinets
    setSelectedCabinet, // Backward compatibility: sets single cabinet
    setSelectedCabinets: setSelectedCabinetsWrapper, // New: sets multiple cabinets (with function support)
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
