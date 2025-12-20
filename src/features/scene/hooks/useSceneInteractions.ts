import React, { useCallback, useEffect, useRef, useState } from "react"
import * as THREE from "three"
import type { CabinetData, WallDimensions } from "../types"
import {
  calculateSnapPosition,
  getSnapGuides,
  DEFAULT_SNAP_CONFIG,
  getCabinetRelativeEffectiveBounds,
} from "../lib/snapUtils"
import {
  updateReturnBulkheads,
} from "../utils/handlers/bulkheadPositionHandler"
import { updateAllDependentComponents } from "../utils/handlers/dependentComponentsHandler"
import type { ViewManager, ViewId } from "../../cabinets/ViewManager"

type CameraDragAPI = {
  startDrag: (x: number, y: number) => void
  move: (x: number, y: number) => void
  end: () => void
  wheel: (deltaY: number) => void
  middleClick: () => void
  startPan: (x: number, y: number) => void
  movePan: (x: number, y: number) => void
}

type OrthoRefs = {
  orthoCameraRef: React.MutableRefObject<THREE.OrthographicCamera | null>
  isOrthoActiveRef: React.MutableRefObject<boolean>
}

export const useSceneInteractions = (
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>,
  wallDimensions: WallDimensions,
  isMenuOpen: boolean,
  cameraMode: "constrained" | "free",
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
  onOpenWallDrawer?: () => void,
  orthoRefs?: OrthoRefs
) => {
  const isDraggingCabinetRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const [isPanningCamera, setIsPanningCamera] = useState(false)
  const [cabinetWithLockIcons, setCabinetWithLockIcons] =
    useState<CabinetData | null>(null)
  const clickStartPositionRef = useRef<{ x: number; y: number } | null>(null)
  const clickStartCabinetRef = useRef<CabinetData | null>(null)
  // Version counter that increments when cabinet drag ends to trigger wall adjustments
  const [dragEndVersion, setDragEndVersion] = useState(0)

  // Helper to get the active camera (ortho when in ortho mode, perspective otherwise)
  const getActiveCamera = useCallback((): THREE.Camera | null => {
    if (orthoRefs?.isOrthoActiveRef.current && orthoRefs?.orthoCameraRef.current) {
      return orthoRefs.orthoCameraRef.current
    }
    return cameraRef.current
  }, [cameraRef, orthoRefs])

  const isEventOnProductPanel = useCallback((target: EventTarget | null) => {
    if (!target) return false
    const el = target as HTMLElement
    return !!(
      (
        el.closest(".productPanel") ||
        el.closest("[data-product-panel]") ||
        el.closest("[data-settings-drawer]") ||
        el.closest("[data-wall-drawer]") ||
        el.closest("[data-views-drawer]") ||
        el.closest("[data-view-drawer]") ||
        el.closest("[data-camera-controls]") ||
        el.closest("button")
      ) // Also ignore all button clicks
    )
  }, [])

  const isMouseOverSelectedCabinet = useCallback(
    (mouseX: number, mouseY: number) => {
      if (selectedCabinets.length === 0) return false
      const camera = getActiveCamera()
      if (!camera) return false
      const mouse = new THREE.Vector2()
      mouse.x = (mouseX / window.innerWidth) * 2 - 1
      mouse.y = -(mouseY / window.innerHeight) * 2 + 1
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, camera)
      // Check if mouse is over any selected cabinet
      return selectedCabinets.some((cab) => {
        const intersects = raycaster.intersectObject(cab.group, true)
        return intersects.length > 0
      })
    },
    [getActiveCamera, selectedCabinets]
  )

  /**
   * Check if a cabinet at the given position would overlap in Y-axis with any other cabinet
   * Returns true if there's Y-axis overlap, false otherwise
   *
   * Note: Top cabinets only check overlap against other top cabinets,
   * and base/tall cabinets only check against other base/tall cabinets.
   * This allows top cabinets to move vertically without being blocked by base cabinets below.
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
        // Use cabinetId comparison instead of reference comparison
        // to handle stale references from clickStartCabinetRef
        if (otherCabinet.cabinetId === cabinet.cabinetId) continue

        // Skip ALL underPanel cabinets - they are "accessory" cabinets that follow their parent
        // and should not block movement of other cabinets
        if (otherCabinet.cabinetType === "underPanel") {
          continue
        }

        const otherX = otherCabinet.group.position.x
        const otherWidth = otherCabinet.carcass.dimensions.width
        const otherY = otherCabinet.group.position.y
        const otherHeight = otherCabinet.carcass.dimensions.height

        const otherLeft = otherX
        const otherRight = otherX + otherWidth
        const otherBottom = otherY
        const otherTop = otherY + otherHeight

        // Check for X-axis overlap (cabinets must overlap in X to check Y overlap)
        const xOverlap = !(
          cabinetRight <= otherLeft || cabinetLeft >= otherRight
        )

        if (xOverlap) {
          // Check for Y-axis overlap
          const yOverlap = !(
            cabinetTop <= otherBottom || cabinetBottom >= otherTop
          )
          if (yOverlap) {
            return true // Y-axis overlap detected
          }
        }
      }

      return false // No Y-axis overlap
    },
    []
  )

  // Helper function to check if a cabinet is a child product that cannot be dragged
  const isChildProduct = useCallback((cabinet: CabinetData): boolean => {
    // Check all child product types
    if (cabinet.kickerParentCabinetId) return true
    if (cabinet.bulkheadParentCabinetId) return true
    if (cabinet.underPanelParentCabinetId) return true
    if (cabinet.benchtopParentCabinetId) return true
    // Fillers and panels attached via modal (hideLockIcons = true)
    if (cabinet.parentCabinetId && cabinet.hideLockIcons === true) return true
    return false
  }, [])

  const moveCabinetWithMouse = useCallback(
    (event: MouseEvent) => {
      if (selectedCabinets.length === 0 || !isDraggingCabinetRef.current) return
      const camera = cameraRef.current
      if (!camera) return
      const deltaX = event.clientX - dragStartRef.current.x
      const deltaY = event.clientY - dragStartRef.current.y
      const worldDeltaX =
        (deltaX / window.innerWidth) * wallDimensions.length * 0.8
      const worldDeltaY =
        -(deltaY / window.innerHeight) * wallDimensions.height * 0.8

      // Use the cabinet being dragged (the one that was clicked on)
      const draggedCabinet = clickStartCabinetRef.current || selectedCabinets[0]
      if (!draggedCabinet) return

      // Prevent child products from being dragged - they follow their parent
      if (isChildProduct(draggedCabinet)) {
        isDraggingCabinetRef.current = false
        return
      }

      const currentX = draggedCabinet.group.position.x
      const currentY = draggedCabinet.group.position.y
      const intendedX = currentX + worldDeltaX
      const intendedY = currentY + worldDeltaY
      let newX = intendedX
      let newY = intendedY

      // Apply boundary clamping FIRST to get valid target position
      // Note: Right wall and internal walls are excluded from boundary checks - cabinets can penetrate them
      // Only left boundary (X=0) and top/bottom boundaries are enforced

      // For single cabinets not in a view, account for left-side children (fillers/panels)
      // to prevent them from going through the left wall
      // Use getCabinetRelativeEffectiveBounds which returns the relative offsets considering children
      let minX = 0
      if (!draggedCabinet.viewId || draggedCabinet.viewId === "none") {
        const { leftOffset } = getCabinetRelativeEffectiveBounds(
          draggedCabinet,
          cabinets
        )
        // leftOffset is negative for left-side children (e.g., -16 for a 16mm panel)
        // So minX = -leftOffset ensures the effective left edge stays at x >= 0
        minX = -leftOffset
      }

      if (draggedCabinet.cabinetType === "top") {
        newX = Math.max(minX, newX) // Clamp left boundary accounting for children
        newY = Math.max(
          0,
          Math.min(
            wallDimensions.height - draggedCabinet.carcass.dimensions.height,
            newY
          )
        )
      } else {
        newX = Math.max(minX, newX) // Clamp left boundary accounting for children
        newY = currentY // Base/tall cabinets stay on ground
      }

      // Ignore cabinets in the same view when calculating snap targets so the whole view can move smoothly
      const snapCandidates =
        draggedCabinet.viewId && draggedCabinet.viewId !== "none"
          ? cabinets.filter((cab) => cab.viewId !== draggedCabinet.viewId)
          : cabinets

      // Apply snap logic AFTER boundary clamping (using dragged cabinet)
      const snapResult = calculateSnapPosition(
        draggedCabinet,
        newX,
        newY,
        snapCandidates,
        DEFAULT_SNAP_CONFIG,
        wallDimensions.additionalWalls, // Pass additional walls for snap detection
        cabinets // Pass full cabinets array for child lookup
      )

      // Use snapped position if snapping occurred
      if (snapResult.snapped) {
        console.log(
          "Snap detected:",
          snapResult.activeSnapPoints.map((s) => s.type)
        )
        newX = snapResult.position.x
        newY = snapResult.position.y

        // Update visual snap guides
        const guides = getSnapGuides(snapResult)
        console.log(
          "Guides:",
          guides.map((g) => `${g.type} at ${g.position.x ?? g.position.y}`)
        )
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
      let actualDeltaX = newX - currentX
      const actualDeltaY = newY - currentY

      // For cabinets in a view, check left wall constraint BEFORE moving anything
      // This prevents the dragged cabinet from moving while others are blocked
      if (
        draggedCabinet.viewId &&
        draggedCabinet.viewId !== "none" &&
        viewManager &&
        actualDeltaX < 0 // Only check when moving left
      ) {
        const cabinetsInSameView = viewManager.getCabinetsInView(
          draggedCabinet.viewId as ViewId
        )

        // Find the leftmost X position in the view (BEFORE any movement)
        let viewMinX = Infinity
        for (const cabinetId of cabinetsInSameView) {
          const cab = cabinets.find((c) => c.cabinetId === cabinetId)
          if (cab) {
            viewMinX = Math.min(viewMinX, cab.group.position.x)
          }
        }

        // If moving left would push the leftmost cabinet past x=0, limit the delta
        if (viewMinX + actualDeltaX < 0) {
          // Limit the delta so leftmost cabinet reaches exactly x=0
          actualDeltaX = -viewMinX
          // Recalculate newX for the dragged cabinet based on the limited delta
          newX = currentX + actualDeltaX
        }
      }

      // Move only the dragged cabinet (not all selected cabinets)
      draggedCabinet.group.position.set(
        newX,
        newY,
        draggedCabinet.group.position.z
      )
      
      // Update all dependent components when parent cabinet moves
      updateAllDependentComponents(draggedCabinet, cabinets, wallDimensions, {
        positionChanged: true
      })

      // Check all overhead and tall cabinets for return bulkhead updates when any cabinet moves
      // This ensures return bulkheads are created/removed when cabinets are snapped or reach walls
      cabinets.forEach((cabinet) => {
        if (cabinet.cabinetType === 'top' || cabinet.cabinetType === 'tall') {
          updateReturnBulkheads(cabinet, cabinets, wallDimensions)
        }
      })

      // If dragged cabinet belongs to a view (not "none"), move ALL cabinets in that view together
      // Note: Left wall boundary is already checked above before moving the dragged cabinet
      // Right wall can be penetrated - cabinets will push behind the right wall
      // This maintains relative positions because they all move by the same delta
      if (
        draggedCabinet.viewId &&
        draggedCabinet.viewId !== "none" &&
        viewManager
      ) {
        const cabinetsInSameView = viewManager.getCabinetsInView(
          draggedCabinet.viewId as ViewId
        )

        cabinetsInSameView.forEach((cabinetId) => {
          const cabinetInView = cabinets.find((c) => c.cabinetId === cabinetId)
          // Skip the dragged cabinet itself (already moved) - use ID comparison to avoid stale reference issues
          if (
            cabinetInView &&
            cabinetInView.cabinetId !== draggedCabinet.cabinetId
          ) {
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
                  wallDimensions.height -
                    cabinetInView.carcass.dimensions.height,
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

            // Update all dependent components when cabinet in view moves
            updateAllDependentComponents(cabinetInView, cabinets, wallDimensions, {
              positionChanged: true
            })
          }
        })

        // After moving cabinets in a view, check if they penetrate the right wall
        // and if the right wall is linked to this view, update back wall length
        // This is handled by the useEffect in ThreeScene.tsx, but we trigger it here
        // by ensuring the cabinet positions are updated
      }

      dragStartRef.current = { x: event.clientX, y: event.clientY }
    },
    [
      cameraRef,
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
      if (isDraggingCabinetRef.current) {
        moveCabinetWithMouse(event)
      } else if (isPanningCamera) {
        cameraDrag.movePan(event.clientX, event.clientY)
      } else if (cameraRef.current) {
        // Check if user started clicking on a cabinet and is now moving (click-and-drag)
        if (
          clickStartPositionRef.current &&
          clickStartCabinetRef.current &&
          selectedCabinets.includes(clickStartCabinetRef.current)
        ) {
          const moveDistance = Math.sqrt(
            Math.pow(event.clientX - clickStartPositionRef.current.x, 2) +
              Math.pow(event.clientY - clickStartPositionRef.current.y, 2)
          )
          // If mouse moved more than 5 pixels, start dragging
          if (moveDistance > 5) {
            isDraggingCabinetRef.current = true
            dragStartRef.current = {
              x: clickStartPositionRef.current.x,
              y: clickStartPositionRef.current.y,
            }
            clickStartPositionRef.current = null
            // Keep clickStartCabinetRef - we need it during drag to avoid stale closure issues
          }
        }
        cameraDrag.move(event.clientX, event.clientY)
      }
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (isMenuOpen) {
        isDraggingCabinetRef.current = false
        setIsPanningCamera(false)
        return
      }
      if (isEventOnProductPanel(event.target)) return

      const hasModifier = event.shiftKey || event.ctrlKey
      const activeCamera = getActiveCamera()

      if (event.button === 0 && activeCamera) {
        // Left click
        if (cameraMode === "free" && !hasModifier) {
          // Free mode without modifier: start orbit rotation
          cameraDrag.startDrag(event.clientX, event.clientY)
          return
        }

        // Constrained mode OR free mode with modifier: handle cabinet interaction
        if (
          selectedCabinet &&
          isMouseOverSelectedCabinet(event.clientX, event.clientY)
        ) {
          isDraggingCabinetRef.current = true
          dragStartRef.current = { x: event.clientX, y: event.clientY }
          // Clear position tracking but keep cabinet ref - we need it during drag
          clickStartPositionRef.current = null
          // Note: clickStartCabinetRef is kept to avoid stale closure issues with selectedCabinets
          return
        }

        // Check for cabinet selection/deselection
        const mouse = new THREE.Vector2()
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
        const raycaster = new THREE.Raycaster()
        raycaster.setFromCamera(mouse, activeCamera)
        const cabinetMeshes: THREE.Object3D[] = []
        cabinets.forEach((cabinet) => {
          cabinet.group.traverse((child) => {
            if (child instanceof THREE.Mesh) cabinetMeshes.push(child)
          })
        })
        const intersects = raycaster.intersectObjects(cabinetMeshes)

        if (cameraMode === "free" && hasModifier && intersects.length > 0) {
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
                const isAlreadySelected = prev.some(
                  (c: CabinetData) => c.cabinetId === clickedCabinet!.cabinetId
                )
                if (isAlreadySelected) {
                  // Deselect if already selected
                  return prev.filter(
                    (c: CabinetData) =>
                      c.cabinetId !== clickedCabinet!.cabinetId
                  )
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
            clickStartPositionRef.current = {
              x: event.clientX,
              y: event.clientY,
            }
            clickStartCabinetRef.current = clickedCabinet
          }
          return
        }

        if (cameraMode === "constrained" && intersects.length > 0) {
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
                const isAlreadySelected = prev.some(
                  (c: CabinetData) => c.cabinetId === clickedCabinet!.cabinetId
                )
                if (isAlreadySelected) {
                  // Deselect if already selected
                  return prev.filter(
                    (c: CabinetData) =>
                      c.cabinetId !== clickedCabinet!.cabinetId
                  )
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
            isDraggingCabinetRef.current = false
            // Store click position and cabinet for potential drag detection
            clickStartPositionRef.current = {
              x: event.clientX,
              y: event.clientY,
            }
            clickStartCabinetRef.current = clickedCabinet
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
          clickStartPositionRef.current = null
          clickStartCabinetRef.current = null
        }

        isDraggingCabinetRef.current = false

        if (cameraMode === "constrained") {
          cameraDrag.startDrag(event.clientX, event.clientY)
        }
      } else if (event.button === 2 && activeCamera) {
        // Right click
        event.preventDefault()

        if (cameraMode === "free" && !hasModifier) {
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
        raycaster.setFromCamera(mouse, activeCamera)
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
        // Check if we were dragging a cabinet before clearing the flag
        const wasDraggingCabinet = isDraggingCabinetRef.current
        cameraDrag.end()
        isDraggingCabinetRef.current = false
        // Clear snap guides when drag ends
        clearSnapGuides()
        // Clear click start tracking
        clickStartPositionRef.current = null
        clickStartCabinetRef.current = null
        // Increment version to trigger wall adjustments after cabinet drag
        if (wasDraggingCabinet) {
          setDragEndVersion(v => v + 1)
        }
      } else if (event.button === 2) {
        cameraDrag.end()
        setIsPanningCamera(false)
      }
    }

    const handleDoubleClick = (event: MouseEvent) => {
      if (isMenuOpen) return
      if (isEventOnProductPanel(event.target)) return
      const activeCamera = getActiveCamera()
      if (!activeCamera) return

      const mouse = new THREE.Vector2()
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, activeCamera)

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

          // Don't show lock icons for fillers/panels/kickers added from modal (marked with hideLockIcons)
          // Also don't show lock icons for kickers (they are separate selectable parts)
          if (clickedCabinet.hideLockIcons === true || clickedCabinet.cabinetType === 'kicker') {
            setCabinetWithLockIcons(null)
            setShowProductPanel(false) // Don't open ProductPanel for kickers
            return // Stop here - don't show icons for fillers/panels/kickers
          }

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
    getActiveCamera,
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
    leftWallRef,
    rightWallRef,
    wallRef,
    onOpenWallDrawer,
  ])

  return {
    isDraggingCabinet: isDraggingCabinetRef.current,
    cabinetWithLockIcons,
    setCabinetWithLockIcons,
    dragEndVersion,
  }
}
