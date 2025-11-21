import { useCallback, useEffect, useState } from "react"
import * as THREE from "three"
import type { CabinetData, WallDimensions } from "../types"
import {
  calculateSnapPosition,
  getSnapGuides,
  DEFAULT_SNAP_CONFIG,
} from "../lib/snapUtils"
import type { ViewManager, ViewId } from '../../cabinets/ViewManager'

type CameraDragAPI = {
  startDrag: (x: number, y: number) => void
  move: (x: number, y: number) => void
  end: () => void
  wheel: (deltaY: number) => void
  middleClick: () => void
  startPan: (x: number, y: number) => void
  movePan: (x: number, y: number) => void
}

export const useSceneInteractions = (
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>,
  wallDimensions: WallDimensions,
  isMenuOpen: boolean,
  cameraMode: 'constrained' | 'free',
  cabinets: CabinetData[],
  selectedCabinet: CabinetData | null,
  setSelectedCabinet: (c: CabinetData | null) => void,
  showProductPanel: boolean,
  setShowProductPanel: (v: boolean) => void,
  cameraDrag: CameraDragAPI,
  updateSnapGuides: (guides: any[]) => void,
  clearSnapGuides: () => void,
  viewManager?: ViewManager
) => {
  const [isDraggingCabinet, setIsDraggingCabinet] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isPanningCamera, setIsPanningCamera] = useState(false)
  const [cabinetWithLockIcons, setCabinetWithLockIcons] = useState<CabinetData | null>(null)

  const isEventOnProductPanel = useCallback((target: EventTarget | null) => {
    if (!target) return false
    const el = target as HTMLElement
    return !!(
      el.closest(".productPanel") || 
      el.closest("[data-product-panel]") ||
      el.closest("[data-settings-drawer]") ||
      el.closest("[data-wall-drawer]") ||
      el.closest("[data-views-drawer]") ||
      el.closest("[data-view-drawer]") ||
      el.closest("[data-camera-controls]") ||
      el.closest("button") // Also ignore all button clicks
    )
  }, [])

  const isMouseOverSelectedCabinet = useCallback(
    (mouseX: number, mouseY: number) => {
      if (!selectedCabinet || !cameraRef.current) return false
      const mouse = new THREE.Vector2()
      mouse.x = (mouseX / window.innerWidth) * 2 - 1
      mouse.y = -(mouseY / window.innerHeight) * 2 + 1
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, cameraRef.current)
      const intersects = raycaster.intersectObject(selectedCabinet.group, true)
      return intersects.length > 0
    },
    [cameraRef, selectedCabinet]
  )

  /**
   * Check if a cabinet at the given position would overlap in Y-axis with any other cabinet
   * Returns true if there's Y-axis overlap, false otherwise
   */
  const hasYAxisOverlap = useCallback(
    (
      cabinet: CabinetData,
      newX: number,
      newY: number,
      allCabinets: CabinetData[]
    ): boolean => {
      const cabinetWidth = cabinet.carcass.dimensions.width
      const cabinetHeight = cabinet.carcass.dimensions.height
      
      const cabinetLeft = newX
      const cabinetRight = newX + cabinetWidth
      const cabinetBottom = newY
      const cabinetTop = newY + cabinetHeight

      // Check against all other cabinets
      for (const otherCabinet of allCabinets) {
        if (otherCabinet === cabinet) continue

        const otherX = otherCabinet.group.position.x
        const otherWidth = otherCabinet.carcass.dimensions.width
        const otherY = otherCabinet.group.position.y
        const otherHeight = otherCabinet.carcass.dimensions.height

        const otherLeft = otherX
        const otherRight = otherX + otherWidth
        const otherBottom = otherY
        const otherTop = otherY + otherHeight

        // Check for X-axis overlap (cabinets must overlap in X to check Y overlap)
        const xOverlap = !(cabinetRight <= otherLeft || cabinetLeft >= otherRight)
        
        if (xOverlap) {
          // Check for Y-axis overlap
          const yOverlap = !(cabinetTop <= otherBottom || cabinetBottom >= otherTop)
          if (yOverlap) {
            return true // Y-axis overlap detected
          }
        }
      }

      return false // No Y-axis overlap
    },
    []
  )

  const moveCabinetWithMouse = useCallback(
    (event: MouseEvent) => {
      if (!selectedCabinet || !isDraggingCabinet) return
      const camera = cameraRef.current
      if (!camera) return
      const deltaX = event.clientX - dragStart.x
      const deltaY = event.clientY - dragStart.y
      const worldDeltaX =
        (deltaX / window.innerWidth) * wallDimensions.length * 0.8
      const worldDeltaY =
        -(deltaY / window.innerHeight) * wallDimensions.height * 0.8
      const currentX = selectedCabinet.group.position.x
      const currentY = selectedCabinet.group.position.y
      let newX = currentX + worldDeltaX
      let newY = currentY + worldDeltaY

      // Apply boundary clamping FIRST to get valid target position
      if (selectedCabinet.cabinetType === "top") {
        newX = Math.max(
          0,
          Math.min(
            wallDimensions.length - selectedCabinet.carcass.dimensions.width,
            newX
          )
        )
        newY = Math.max(
          0,
          Math.min(
            wallDimensions.height - selectedCabinet.carcass.dimensions.height,
            newY
          )
        )
      } else {
        newX = Math.max(
          0,
          Math.min(
            wallDimensions.length - selectedCabinet.carcass.dimensions.width,
            newX
          )
        )
        newY = currentY // Base/tall cabinets stay on ground
      }

      // Apply snap logic AFTER boundary clamping
      const snapResult = calculateSnapPosition(
        selectedCabinet,
        newX,
        newY,
        cabinets,
        DEFAULT_SNAP_CONFIG,
        wallDimensions.additionalWalls // Pass additional walls for snap detection
      )

      // Use snapped position if snapping occurred
      if (snapResult.snapped) {
        console.log('Snap detected:', snapResult.activeSnapPoints.map(s => s.type))
        newX = snapResult.position.x
        newY = snapResult.position.y

        // Update visual snap guides
        const guides = getSnapGuides(snapResult)
        console.log('Guides:', guides.map(g => `${g.type} at ${g.position.x ?? g.position.y}`))
        updateSnapGuides(guides)
      } else {
        // Clear snap guides if not snapping
        clearSnapGuides()
      }

      // Check for Y-axis overlap before moving
      // If there's Y-axis overlap, prevent Y movement (keep current Y)
      if (hasYAxisOverlap(selectedCabinet, newX, newY, cabinets)) {
        // Keep the current Y position to prevent overlap
        newY = currentY
      }

      // Calculate the actual movement delta
      const actualDeltaX = newX - currentX
      const actualDeltaY = newY - currentY

      // Move the dragged cabinet
      selectedCabinet.group.position.set(
        newX,
        newY,
        selectedCabinet.group.position.z
      )

      // If cabinet belongs to a view (not "none"), move ALL cabinets in that view together
      // This maintains relative positions because they all move by the same delta
      if (selectedCabinet.viewId && selectedCabinet.viewId !== "none" && viewManager) {
        const cabinetsInSameView = viewManager.getCabinetsInView(selectedCabinet.viewId as ViewId)
        
        cabinetsInSameView.forEach((cabinetId) => {
          const cabinetInView = cabinets.find(c => c.cabinetId === cabinetId)
          if (cabinetInView && cabinetInView !== selectedCabinet) {
            const cabinetCurrentX = cabinetInView.group.position.x
            const cabinetCurrentY = cabinetInView.group.position.y
            const cabinetNewX = cabinetCurrentX + actualDeltaX
            const cabinetNewY = cabinetCurrentY + actualDeltaY

            // Apply boundary clamping for each cabinet in the view
            let clampedX = cabinetNewX
            let clampedY = cabinetNewY

            if (cabinetInView.cabinetType === "top") {
              clampedX = Math.max(
                0,
                Math.min(
                  wallDimensions.length - cabinetInView.carcass.dimensions.width,
                  cabinetNewX
                )
              )
              clampedY = Math.max(
                0,
                Math.min(
                  wallDimensions.height - cabinetInView.carcass.dimensions.height,
                  cabinetNewY
                )
              )
            } else {
              clampedX = Math.max(
                0,
                Math.min(
                  wallDimensions.length - cabinetInView.carcass.dimensions.width,
                  cabinetNewX
                )
              )
              clampedY = cabinetCurrentY // Base/tall cabinets stay on ground
            }

            // Check for Y-axis overlap before moving cabinets in the view
            // If there's Y-axis overlap, prevent Y movement (keep current Y)
            if (hasYAxisOverlap(cabinetInView, clampedX, clampedY, cabinets)) {
              // Keep the current Y position to prevent overlap
              clampedY = cabinetCurrentY
            }

            cabinetInView.group.position.set(
              clampedX,
              clampedY,
              cabinetInView.group.position.z
            )
          }
        })
      }

      setDragStart({ x: event.clientX, y: event.clientY })
    },
    [
      cameraRef,
      dragStart.x,
      dragStart.y,
      isDraggingCabinet,
      selectedCabinet,
      wallDimensions.height,
      wallDimensions.length,
      cabinets,
      updateSnapGuides,
      clearSnapGuides,
      viewManager,
      hasYAxisOverlap,
    ]
  )

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (isDraggingCabinet) {
        moveCabinetWithMouse(event)
      } else if (isPanningCamera) {
        cameraDrag.movePan(event.clientX, event.clientY)
      } else if (cameraRef.current) {
        cameraDrag.move(event.clientX, event.clientY)
      }
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (isMenuOpen) {
        setIsDraggingCabinet(false)
        setIsPanningCamera(false)
        return
      }
      if (isEventOnProductPanel(event.target)) return

      const hasModifier = event.shiftKey || event.ctrlKey

      if (event.button === 0 && cameraRef.current) {
        // Left click
        if (cameraMode === 'free' && !hasModifier) {
          // Free mode without modifier: start orbit rotation
          cameraDrag.startDrag(event.clientX, event.clientY)
          return
        }

        // Constrained mode OR free mode with modifier: handle cabinet interaction
        if (
          selectedCabinet &&
          isMouseOverSelectedCabinet(event.clientX, event.clientY)
        ) {
          setIsDraggingCabinet(true)
          setDragStart({ x: event.clientX, y: event.clientY })
          return
        }

        // Check for cabinet selection/deselection
        const mouse = new THREE.Vector2()
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
        const raycaster = new THREE.Raycaster()
        raycaster.setFromCamera(mouse, cameraRef.current)
        const cabinetMeshes: THREE.Object3D[] = []
        cabinets.forEach((cabinet) => {
          cabinet.group.traverse((child) => {
            if (child instanceof THREE.Mesh) cabinetMeshes.push(child)
          })
        })
        const intersects = raycaster.intersectObjects(cabinetMeshes)

        if (cameraMode === 'free' && hasModifier && intersects.length > 0) {
          // Free mode with modifier: select cabinet
          const intersectedMesh = intersects[0].object
          let selected: CabinetData | null = null
          for (const cab of cabinets) {
            let found = false
            cab.group.traverse((child) => {
              if (child === intersectedMesh) found = true
            })
            if (found) {
              selected = cab
              break
            }
          }
          if (selected) {
            setSelectedCabinet(selected)
            setShowProductPanel(true)
          }
          return
        }

        if (intersects.length === 0) {
          setShowProductPanel(false)
          setSelectedCabinet(null)
        }

        setIsDraggingCabinet(false)

        if (cameraMode === 'constrained') {
          cameraDrag.startDrag(event.clientX, event.clientY)
        }
      } else if (event.button === 2 && cameraRef.current) {
        // Right click
        event.preventDefault()

        if (cameraMode === 'free' && !hasModifier) {
          // Free mode without modifier: start camera pan
          setIsPanningCamera(true)
          cameraDrag.startPan(event.clientX, event.clientY)
          return
        }

        // Constrained mode OR free mode with modifier: select cabinet
        const mouse = new THREE.Vector2()
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
        const raycaster = new THREE.Raycaster()
        raycaster.setFromCamera(mouse, cameraRef.current)
        const cabinetMeshes: THREE.Object3D[] = []
        cabinets.forEach((cabinet) => {
          cabinet.group.traverse((child) => {
            if (child instanceof THREE.Mesh) cabinetMeshes.push(child)
          })
        })
        const intersects = raycaster.intersectObjects(cabinetMeshes)
        if (intersects.length > 0) {
          const intersectedMesh = intersects[0].object
          let selected: CabinetData | null = null
          for (const cab of cabinets) {
            let found = false
            cab.group.traverse((child) => {
              if (child === intersectedMesh) found = true
            })
            if (found) {
              selected = cab
              break
            }
          }
          if (selected) {
            setSelectedCabinet(selected)
            setShowProductPanel(true)
          }
        } else {
          setShowProductPanel(false)
          setSelectedCabinet(null)
        }
      }
    }

    const handleMouseUp = (event: MouseEvent) => {
      if (event.button === 0) {
        cameraDrag.end()
        setIsDraggingCabinet(false)
        // Clear snap guides when drag ends
        clearSnapGuides()
      } else if (event.button === 2) {
        cameraDrag.end()
        setIsPanningCamera(false)
      }
    }

    const handleDoubleClick = (event: MouseEvent) => {
      if (isMenuOpen) return
      if (isEventOnProductPanel(event.target)) return
      if (!cameraRef.current) return

      // Detect double-click on cabinet
      const mouse = new THREE.Vector2()
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, cameraRef.current)
      const cabinetMeshes: THREE.Object3D[] = []
      cabinets.forEach((cabinet) => {
        cabinet.group.traverse((child) => {
          if (child instanceof THREE.Mesh) cabinetMeshes.push(child)
        })
      })
      const intersects = raycaster.intersectObjects(cabinetMeshes)

      if (intersects.length > 0) {
        const intersectedMesh = intersects[0].object
        let clickedCabinet: CabinetData | null = null
        for (const cab of cabinets) {
          let found = false
          cab.group.traverse((child) => {
            if (child === intersectedMesh) found = true
          })
          if (found) {
            clickedCabinet = cab
            break
          }
        }
        if (clickedCabinet) {
          // Set the cabinet as selected to apply the same highlight as right-click
          setSelectedCabinet(clickedCabinet)
          
          // Toggle lock icons - if same cabinet, hide; if different, show on new one
          if (cabinetWithLockIcons === clickedCabinet) {
            setCabinetWithLockIcons(null)
          } else {
            setCabinetWithLockIcons(clickedCabinet)
          }
        }
      } else {
        // Clicked outside - hide lock icons
        setCabinetWithLockIcons(null)
      }
    }

    const handleWheel = (event: WheelEvent) => {
      if (isMenuOpen) {
        return
      }
      if (isEventOnProductPanel(event.target)) return
      event.preventDefault()
      cameraDrag.wheel(event.deltaY)
    }

    const handleMiddleClick = (event: MouseEvent) => {
      if (isMenuOpen) return
      if (isEventOnProductPanel(event.target)) return
      if (event.button === 1) {
        event.preventDefault()
        cameraDrag.middleClick()
      }
    }

    const preventContext = (e: Event) => e.preventDefault()

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mousedown", handleMouseDown)
    document.addEventListener("mouseup", handleMouseUp)
    document.addEventListener("dblclick", handleDoubleClick)
    document.addEventListener("wheel", handleWheel, { passive: false })
    document.addEventListener("mousedown", handleMiddleClick)
    document.addEventListener("contextmenu", preventContext)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mousedown", handleMouseDown)
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("dblclick", handleDoubleClick)
      document.removeEventListener("wheel", handleWheel as any)
      document.removeEventListener("mousedown", handleMiddleClick)
      document.removeEventListener("contextmenu", preventContext)
    }
  }, [
    cameraRef,
    cameraDrag,
    cameraMode,
    cabinets,
    isMenuOpen,
    isPanningCamera,
    isMouseOverSelectedCabinet,
    isEventOnProductPanel,
    moveCabinetWithMouse,
    selectedCabinet,
    setSelectedCabinet,
    setShowProductPanel,
    showProductPanel,
    clearSnapGuides,
    cabinetWithLockIcons,
  ])

  return { isDraggingCabinet, cabinetWithLockIcons, setCabinetWithLockIcons }
}
