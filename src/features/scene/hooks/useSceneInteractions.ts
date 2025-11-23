import React, { useCallback, useEffect, useState } from "react"
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
  selectedCabinets: CabinetData[],
  setSelectedCabinet: (c: CabinetData | null) => void,
  setSelectedCabinets: React.Dispatch<React.SetStateAction<CabinetData[]>>,
  showProductPanel: boolean,
  setShowProductPanel: (v: boolean) => void,
  cameraDrag: CameraDragAPI,
  updateSnapGuides: (guides: any[]) => void,
  clearSnapGuides: () => void,
  viewManager?: ViewManager,
  wallRef?: React.MutableRefObject<THREE.Group | null>,
  leftWallRef?: React.MutableRefObject<THREE.Group | null>,
  rightWallRef?: React.MutableRefObject<THREE.Group | null>,
  onOpenWallDrawer?: () => void
) => {
  const [isDraggingCabinet, setIsDraggingCabinet] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isPanningCamera, setIsPanningCamera] = useState(false)
  const [cabinetWithLockIcons, setCabinetWithLockIcons] = useState<CabinetData | null>(null)
  const [clickStartPosition, setClickStartPosition] = useState<{ x: number; y: number } | null>(null)
  const [clickStartCabinet, setClickStartCabinet] = useState<CabinetData | null>(null)

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
      if (selectedCabinets.length === 0 || !cameraRef.current) return false
      const mouse = new THREE.Vector2()
      mouse.x = (mouseX / window.innerWidth) * 2 - 1
      mouse.y = -(mouseY / window.innerHeight) * 2 + 1
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, cameraRef.current)
      // Check if mouse is over any selected cabinet
      return selectedCabinets.some(cab => {
        const intersects = raycaster.intersectObject(cab.group, true)
        return intersects.length > 0
      })
    },
    [cameraRef, selectedCabinets]
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
      if (selectedCabinets.length === 0 || !isDraggingCabinet) return
      const camera = cameraRef.current
      if (!camera) return
      const deltaX = event.clientX - dragStart.x
      const deltaY = event.clientY - dragStart.y
      const worldDeltaX =
        (deltaX / window.innerWidth) * wallDimensions.length * 0.8
      const worldDeltaY =
        -(deltaY / window.innerHeight) * wallDimensions.height * 0.8
      
      // Use the cabinet being dragged (the one that was clicked on)
      const draggedCabinet = clickStartCabinet || selectedCabinets[0]
      if (!draggedCabinet) return
      
      const currentX = draggedCabinet.group.position.x
      const currentY = draggedCabinet.group.position.y
      const intendedX = currentX + worldDeltaX
      const intendedY = currentY + worldDeltaY
      let newX = intendedX
      let newY = intendedY

      // Apply boundary clamping FIRST to get valid target position
      // Note: Right wall and internal walls are excluded from boundary checks - cabinets can penetrate them
      // Only left boundary (X=0) and top/bottom boundaries are enforced
      if (draggedCabinet.cabinetType === "top") {
        newX = Math.max(0, newX) // Only clamp left boundary, allow penetration into right wall
        newY = Math.max(
          0,
          Math.min(
            wallDimensions.height - draggedCabinet.carcass.dimensions.height,
            newY
          )
        )
      } else {
        newX = Math.max(0, newX) // Only clamp left boundary, allow penetration into right wall
        newY = currentY // Base/tall cabinets stay on ground
      }

      // Apply snap logic AFTER boundary clamping (using dragged cabinet)
      const snapResult = calculateSnapPosition(
        draggedCabinet,
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
      if (hasYAxisOverlap(draggedCabinet, newX, newY, cabinets)) {
        // Keep the current Y position to prevent overlap
        newY = currentY
      }

      // Calculate the actual movement delta
      const actualDeltaX = newX - currentX
      const actualDeltaY = newY - currentY

      // Move only the dragged cabinet (not all selected cabinets)
      draggedCabinet.group.position.set(
        newX,
        newY,
        draggedCabinet.group.position.z
      )

      // If dragged cabinet belongs to a view (not "none"), check view boundary and move view cabinets
      // Note: Right wall can be penetrated - cabinets will push behind the right wall
      if (draggedCabinet.viewId && draggedCabinet.viewId !== "none" && viewManager) {
        const cabinetsInSameView = viewManager.getCabinetsInView(draggedCabinet.viewId as ViewId)
        
        // Calculate current min and max X positions in the view
        let minX = Infinity
        let maxX = -Infinity
        
        for (const cabinetId of cabinetsInSameView) {
          const cabinetInView = cabinets.find(c => c.cabinetId === cabinetId)
          if (cabinetInView) {
            const cabinetX = cabinetInView.group.position.x
            const cabinetWidth = cabinetInView.carcass.dimensions.width
            const cabinetRight = cabinetX + cabinetWidth
            
            minX = Math.min(minX, cabinetX)
            maxX = Math.max(maxX, cabinetRight)
          }
        }
        
        // Calculate what the new min and max X would be after movement
        const newMinX = minX + actualDeltaX
        
        // Only check left boundary - right wall can be penetrated
        // If minimum X would be 0 or less, stop all movement (left boundary reached)
        if (newMinX <= 0) {
          // Don't move any cabinets - stop movement but allow resize
          return
        }
        
        // Note: Right wall boundary check removed - cabinets can penetrate and push the right wall
        // The right wall position will be adjusted automatically if it's linked to this view
      }

      // If dragged cabinet belongs to a view (not "none"), move ALL cabinets in that view together
      // This maintains relative positions because they all move by the same delta
      if (draggedCabinet.viewId && draggedCabinet.viewId !== "none" && viewManager) {
        const cabinetsInSameView = viewManager.getCabinetsInView(draggedCabinet.viewId as ViewId)
        
        cabinetsInSameView.forEach((cabinetId) => {
          const cabinetInView = cabinets.find(c => c.cabinetId === cabinetId)
          // Skip the dragged cabinet itself (already moved)
          if (cabinetInView && cabinetInView !== draggedCabinet) {
            const cabinetCurrentX = cabinetInView.group.position.x
            const cabinetCurrentY = cabinetInView.group.position.y
            const cabinetNewX = cabinetCurrentX + actualDeltaX
            const cabinetNewY = cabinetCurrentY + actualDeltaY

            // Apply boundary clamping for each cabinet in the view
            let clampedX = cabinetNewX
            let clampedY = cabinetNewY

            if (cabinetInView.cabinetType === "top") {
              clampedX = Math.max(0, cabinetNewX) // Only clamp left boundary, allow penetration into right wall
              clampedY = Math.max(
                0,
                Math.min(
                  wallDimensions.height - cabinetInView.carcass.dimensions.height,
                  cabinetNewY
                )
              )
            } else {
              clampedX = Math.max(0, cabinetNewX) // Only clamp left boundary, allow penetration into right wall
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
        
        // After moving cabinets in a view, check if they penetrate the right wall
        // and if the right wall is linked to this view, update back wall length
        // This is handled by the useEffect in ThreeScene.tsx, but we trigger it here
        // by ensuring the cabinet positions are updated
      }

      setDragStart({ x: event.clientX, y: event.clientY })
    },
    [
      cameraRef,
      dragStart.x,
      dragStart.y,
      isDraggingCabinet,
      selectedCabinets,
      wallDimensions.height,
      wallDimensions.length,
      cabinets,
      updateSnapGuides,
      clearSnapGuides,
      viewManager,
      hasYAxisOverlap,
      wallRef,
      leftWallRef,
      rightWallRef,
      onOpenWallDrawer,
    ]
  )

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (isDraggingCabinet) {
        moveCabinetWithMouse(event)
      } else if (isPanningCamera) {
        cameraDrag.movePan(event.clientX, event.clientY)
      } else if (cameraRef.current) {
        // Check if user started clicking on a cabinet and is now moving (click-and-drag)
        if (clickStartPosition && clickStartCabinet && selectedCabinets.includes(clickStartCabinet)) {
          const moveDistance = Math.sqrt(
            Math.pow(event.clientX - clickStartPosition.x, 2) + 
            Math.pow(event.clientY - clickStartPosition.y, 2)
          )
          // If mouse moved more than 5 pixels, start dragging
          if (moveDistance > 5) {
            setIsDraggingCabinet(true)
            setDragStart({ x: clickStartPosition.x, y: clickStartPosition.y })
            setClickStartPosition(null)
            setClickStartCabinet(null)
          }
        }
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
          // Clear click tracking since we're starting drag immediately
          setClickStartPosition(null)
          setClickStartCabinet(null)
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
          // Free mode with modifier: select cabinet (without opening panel)
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
            // Check if Shift key is held for multi-select
            if (event.shiftKey) {
              // Multi-select: toggle cabinet in selection
              setSelectedCabinets((prev: CabinetData[]) => {
                const isAlreadySelected = prev.some((c: CabinetData) => c.cabinetId === clickedCabinet!.cabinetId)
                if (isAlreadySelected) {
                  // Deselect if already selected
                  return prev.filter((c: CabinetData) => c.cabinetId !== clickedCabinet!.cabinetId)
                } else {
                  // Add to selection
                  return [...prev, clickedCabinet!]
                }
              })
            } else {
              // Single select: replace selection
              setSelectedCabinets([clickedCabinet])
            }
            // Don't open panel on single click
            // Store click position and cabinet for potential drag detection
            setClickStartPosition({ x: event.clientX, y: event.clientY })
            setClickStartCabinet(clickedCabinet)
          }
          return
        }

        if (cameraMode === 'constrained' && intersects.length > 0) {
          // Constrained mode: select cabinet on single click (without opening panel)
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
            // Check if Shift key is held for multi-select
            if (event.shiftKey) {
              // Multi-select: toggle cabinet in selection
              setSelectedCabinets((prev: CabinetData[]) => {
                const isAlreadySelected = prev.some((c: CabinetData) => c.cabinetId === clickedCabinet!.cabinetId)
                if (isAlreadySelected) {
                  // Deselect if already selected
                  return prev.filter((c: CabinetData) => c.cabinetId !== clickedCabinet!.cabinetId)
                } else {
                  // Add to selection
                  return [...prev, clickedCabinet!]
                }
              })
            } else {
              // Single select: replace selection
              setSelectedCabinets([clickedCabinet])
            }
            // Don't open panel on single click - only right-click opens it
            setIsDraggingCabinet(false)
            // Store click position and cabinet for potential drag detection
            setClickStartPosition({ x: event.clientX, y: event.clientY })
            setClickStartCabinet(clickedCabinet)
            return
          }
        }

        if (intersects.length === 0) {
          // Clicked outside cabinets - deselect but don't close panel if it's already open
          // Only deselect if Shift is not held (Shift+click outside should keep selection)
          if (!event.shiftKey) {
            setSelectedCabinets([])
          }
          // Clear click tracking
          setClickStartPosition(null)
          setClickStartCabinet(null)
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
            // Right-click: always open panel with single selection
            setSelectedCabinets([clickedCabinet])
            setShowProductPanel(true)
          }
        } else {
          // Right-click outside: close panel but keep selection if Shift is held
          if (!event.shiftKey) {
            setSelectedCabinets([])
          }
          setShowProductPanel(false)
        }
      }
    }

    const handleMouseUp = (event: MouseEvent) => {
      if (event.button === 0) {
        cameraDrag.end()
        setIsDraggingCabinet(false)
        // Clear snap guides when drag ends
        clearSnapGuides()
        // Clear click start tracking
        setClickStartPosition(null)
        setClickStartCabinet(null)
      } else if (event.button === 2) {
        cameraDrag.end()
        setIsPanningCamera(false)
      }
    }

    const handleDoubleClick = (event: MouseEvent) => {
      if (isMenuOpen) return
      if (isEventOnProductPanel(event.target)) return
      if (!cameraRef.current) return

      const mouse = new THREE.Vector2()
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, cameraRef.current)

      // Collect all meshes: cabinets and walls
      const cabinetMeshes: THREE.Object3D[] = []
      cabinets.forEach((cabinet) => {
        cabinet.group.traverse((child) => {
          if (child instanceof THREE.Mesh) cabinetMeshes.push(child)
        })
      })

      const wallMeshes: THREE.Object3D[] = []
      if (wallRef?.current) {
        wallRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) wallMeshes.push(child)
        })
      }
      if (leftWallRef?.current) {
        leftWallRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) wallMeshes.push(child)
        })
      }
      if (rightWallRef?.current) {
        rightWallRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) wallMeshes.push(child)
        })
      }

      // Check all objects together - raycaster returns intersections sorted by distance
      const allMeshes = [...cabinetMeshes, ...wallMeshes]
      const allIntersects = raycaster.intersectObjects(allMeshes)
      
      if (allIntersects.length > 0) {
        const closestIntersect = allIntersects[0]
        const intersectedMesh = closestIntersect.object
        
        // Check if the closest intersection is a cabinet (cabinets have priority)
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
          // Cabinet was double-clicked - handle cabinet interaction
          // Double-click selects single cabinet and shows lock icons
          setSelectedCabinets([clickedCabinet])
          
          // Toggle lock icons - if same cabinet, hide; if different, show on new one
          if (cabinetWithLockIcons === clickedCabinet) {
            setCabinetWithLockIcons(null)
          } else {
            setCabinetWithLockIcons(clickedCabinet)
          }
          return // Stop here - cabinet interaction takes priority
        }
        
        // Check if the closest intersection is a wall (no cabinet was in front)
        const isWall = wallMeshes.includes(intersectedMesh as THREE.Object3D)
        if (isWall && onOpenWallDrawer) {
          // Double-clicked on empty space of a wall - open wall settings drawer
          onOpenWallDrawer()
          return
        }
      }

      // Clicked outside cabinets and walls - hide lock icons
      setCabinetWithLockIcons(null)
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
    selectedCabinets,
    setSelectedCabinet,
    setSelectedCabinets,
    setShowProductPanel,
    showProductPanel,
    clearSnapGuides,
    cabinetWithLockIcons,
    clickStartPosition,
    clickStartCabinet,
  ])

  return { 
    isDraggingCabinet, 
    cabinetWithLockIcons, 
    setCabinetWithLockIcons
  }
}
