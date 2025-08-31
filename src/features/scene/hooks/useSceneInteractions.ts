import { useCallback, useEffect, useState } from "react"
import * as THREE from "three"
import type { CabinetData, WallDimensions } from "../types"

type CameraDragAPI = {
  startDrag: (x: number, y: number) => void
  move: (x: number, y: number) => void
  end: () => void
  wheel: (deltaY: number) => void
  middleClick: () => void
}

export const useSceneInteractions = (
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>,
  wallDimensions: WallDimensions,
  isMenuOpen: boolean,
  cabinets: CabinetData[],
  selectedCabinet: CabinetData | null,
  setSelectedCabinet: (c: CabinetData | null) => void,
  showProductPanel: boolean,
  setShowProductPanel: (v: boolean) => void,
  cameraDrag: CameraDragAPI
) => {
  const [isDraggingCabinet, setIsDraggingCabinet] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const isEventOnProductPanel = useCallback((target: EventTarget | null) => {
    if (!target) return false
    const el = target as HTMLElement
    return !!(el.closest(".productPanel") || el.closest("[data-productPanel]"))
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
        newY = currentY
      }
      selectedCabinet.group.position.set(
        newX,
        newY,
        selectedCabinet.group.position.z
      )
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
    ]
  )

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (isDraggingCabinet) {
        moveCabinetWithMouse(event)
      } else if (cameraRef.current) {
        cameraDrag.move(event.clientX, event.clientY)
      }
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (isMenuOpen) {
        setIsDraggingCabinet(false)
        return
      }
      if (isEventOnProductPanel(event.target)) return
      if (event.button === 0 && cameraRef.current) {
        if (
          selectedCabinet &&
          isMouseOverSelectedCabinet(event.clientX, event.clientY)
        ) {
          setIsDraggingCabinet(true)
          setDragStart({ x: event.clientX, y: event.clientY })
          return
        }
        // close panel if clicking empty
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
        if (intersects.length === 0) {
          setShowProductPanel(false)
          setSelectedCabinet(null)
        }
        setIsDraggingCabinet(false)
        cameraDrag.startDrag(event.clientX, event.clientY)
      } else if (event.button === 2 && cameraRef.current) {
        event.preventDefault()
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
    document.addEventListener("wheel", handleWheel, { passive: false })
    document.addEventListener("mousedown", handleMiddleClick)
    document.addEventListener("contextmenu", preventContext)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mousedown", handleMouseDown)
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("wheel", handleWheel as any)
      document.removeEventListener("mousedown", handleMiddleClick)
      document.removeEventListener("contextmenu", preventContext)
    }
  }, [
    cameraRef,
    cameraDrag,
    cabinets,
    isMenuOpen,
    isMouseOverSelectedCabinet,
    isEventOnProductPanel,
    moveCabinetWithMouse,
    selectedCabinet,
    setSelectedCabinet,
    setShowProductPanel,
    showProductPanel,
  ])

  return { isDraggingCabinet }
}
