// After using renderer.setAnimationLoop

import { useEffect, useRef, useCallback } from "react"
import * as THREE from "three"
import {
  buildWall,
  buildFloor,
  buildLeftWall,
  buildRightWall,
  buildAdditionalWall,
  positionCamera,
  WALL_THICKNESS,
} from "../lib/sceneUtils"
import type { WallDimensions } from "../types"

export const useThreeRenderer = (
  mountRef: React.RefObject<HTMLDivElement>,
  wallDimensions: WallDimensions,
  wallColor: string,
  onDimensionsChange?: (dimensions: WallDimensions) => void
) => {
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const orthoCameraRef = useRef<THREE.OrthographicCamera | null>(null)
  const isOrthoActiveRef = useRef<boolean>(false)
  const wallRef = useRef<THREE.Group | null>(null)
  const leftWallRef = useRef<THREE.Group | null>(null)
  const rightWallRef = useRef<THREE.Group | null>(null)
  const additionalWallsRef = useRef<Map<string, THREE.Group>>(new Map())
  const floorRef = useRef<THREE.Mesh | null>(null)
  const floorGridRef = useRef<THREE.GridHelper | null>(null)
  const wallColorRef = useRef(wallColor)

  const createWall = useCallback(
    (height: number, length: number, color?: string) => {
      const scene = sceneRef.current
      if (!scene) return

      if (wallRef.current) {
        scene.remove(wallRef.current)
        wallRef.current.traverse((child) => {
          const anyChild = child as any
          if (anyChild.geometry) anyChild.geometry.dispose()
          if (anyChild.material) {
            if (Array.isArray(anyChild.material))
              anyChild.material.forEach((m: THREE.Material) => m.dispose())
            else (anyChild.material as THREE.Material).dispose()
          }
        })
      }

      const wallGroup = buildWall({ height, length }, color || wallColor)
      wallRef.current = wallGroup
      scene.add(wallGroup)
    },
    [wallColor]
  )

  const createLeftWall = useCallback(
    (height: number, length: number, visible: boolean, color?: string) => {
      const scene = sceneRef.current
      if (!scene) return

      if (leftWallRef.current) {
        scene.remove(leftWallRef.current)
        leftWallRef.current.traverse((child) => {
          const anyChild = child as any
          if (anyChild.geometry) anyChild.geometry.dispose()
          if (anyChild.material) {
            if (Array.isArray(anyChild.material))
              anyChild.material.forEach((m: THREE.Material) => m.dispose())
            else (anyChild.material as THREE.Material).dispose()
          }
        })
      }

      if (visible) {
        const wallGroup = buildLeftWall(height, length, color || wallColor)
        leftWallRef.current = wallGroup
        scene.add(wallGroup)
      } else {
        leftWallRef.current = null
      }
    },
    [wallColor]
  )

  const createRightWall = useCallback(
    (height: number, length: number, backWallLength: number, visible: boolean, color?: string) => {
      const scene = sceneRef.current
      if (!scene) return

      if (rightWallRef.current) {
        scene.remove(rightWallRef.current)
        rightWallRef.current.traverse((child) => {
          const anyChild = child as any
          if (anyChild.geometry) anyChild.geometry.dispose()
          if (anyChild.material) {
            if (Array.isArray(anyChild.material))
              anyChild.material.forEach((m: THREE.Material) => m.dispose())
            else (anyChild.material as THREE.Material).dispose()
          }
        })
      }

      if (visible) {
        const wallGroup = buildRightWall(height, length, backWallLength, color || wallColor)
        rightWallRef.current = wallGroup
        scene.add(wallGroup)
      } else {
        rightWallRef.current = null
      }
    },
    [wallColor]
  )

  const createAdditionalWalls = useCallback(
    (height: number, additionalWalls: Array<{ id: string; length: number; distanceFromLeft: number; thickness?: number }>, color?: string) => {
      const scene = sceneRef.current
      if (!scene) return

      // Remove all existing additional walls
      additionalWallsRef.current.forEach((wallGroup) => {
        scene.remove(wallGroup)
        wallGroup.traverse((child) => {
          const anyChild = child as any
          if (anyChild.geometry) anyChild.geometry.dispose()
          if (anyChild.material) {
            if (Array.isArray(anyChild.material))
              anyChild.material.forEach((m: THREE.Material) => m.dispose())
            else (anyChild.material as THREE.Material).dispose()
          }
        })
      })
      additionalWallsRef.current.clear()

      // Create new additional walls
      additionalWalls.forEach((wallData) => {
        const thickness = wallData.thickness ?? WALL_THICKNESS
        const wallGroup = buildAdditionalWall(height, wallData.length, wallData.distanceFromLeft, color || wallColor, thickness)
        additionalWallsRef.current.set(wallData.id, wallGroup)
        scene.add(wallGroup)
      })
    },
    [wallColor]
  )

  const createFloor = useCallback((wallLength: number) => {
    const scene = sceneRef.current
    if (!scene) return

    if (floorRef.current) {
      scene.remove(floorRef.current)
      floorRef.current.geometry.dispose()
      const mat = floorRef.current.material as THREE.Material | THREE.Material[]
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat.dispose()
    }

    if (floorGridRef.current) {
      scene.remove(floorGridRef.current)
      floorGridRef.current.geometry.dispose()
      ;(floorGridRef.current.material as THREE.Material).dispose()
    }

    const { floor, grid } = buildFloor(wallLength)
    floorRef.current = floor
    floorGridRef.current = grid
    scene.add(floor)
    scene.add(grid)
  }, [])

  const updateCameraPosition = useCallback(
    (height: number, length: number, zoomLevel: number) => {
      if (!cameraRef.current) return
      positionCamera(cameraRef.current, { height, length }, zoomLevel)
    },
    []
  )

  const resetCamera = useCallback(
    (zoomLevel: number) => {
      if (!cameraRef.current) return
      // Switch back to perspective camera
      isOrthoActiveRef.current = false
      positionCamera(cameraRef.current, wallDimensions, zoomLevel)
    },
    [wallDimensions]
  )

  // Helper to set up orthographic camera for a specific view
  const setupOrthoCamera = useCallback(
    (viewAxis: 'x' | 'y' | 'z') => {
      const orthoCamera = orthoCameraRef.current
      if (!orthoCamera) return

      const aspect = window.innerWidth / window.innerHeight
      const wallCenterX = wallDimensions.length / 2
      const wallCenterY = wallDimensions.height / 2
      const wallCenterZ = -WALL_THICKNESS / 2
      const padding = 1.2 // 20% padding

      let frustumHeight: number
      let frustumWidth: number

      if (viewAxis === 'y') {
        // Front view: looking at X-Y plane (wall face)
        frustumWidth = wallDimensions.length * padding
        frustumHeight = frustumWidth / aspect
        // Make sure we can see the full height
        if (frustumHeight < wallDimensions.height * padding) {
          frustumHeight = wallDimensions.height * padding
          frustumWidth = frustumHeight * aspect
        }
      } else if (viewAxis === 'x') {
        // Side view: looking at Y-Z plane
        const leftWallLength = wallDimensions.leftWallLength ?? 600
        frustumWidth = Math.max(leftWallLength, wallDimensions.height) * padding
        frustumHeight = frustumWidth / aspect
        if (frustumHeight < wallDimensions.height * padding) {
          frustumHeight = wallDimensions.height * padding
          frustumWidth = frustumHeight * aspect
        }
      } else {
        // Top view: looking at X-Z plane
        const leftWallLength = wallDimensions.leftWallLength ?? 600
        frustumWidth = wallDimensions.length * padding
        frustumHeight = frustumWidth / aspect
        if (frustumHeight < leftWallLength * padding) {
          frustumHeight = leftWallLength * padding
          frustumWidth = frustumHeight * aspect
        }
      }

      orthoCamera.left = -frustumWidth / 2
      orthoCamera.right = frustumWidth / 2
      orthoCamera.top = frustumHeight / 2
      orthoCamera.bottom = -frustumHeight / 2
      orthoCamera.near = 0.1
      orthoCamera.far = 50000
      orthoCamera.updateProjectionMatrix()

      // Position camera at a far distance along the view axis
      const distance = 10000

      if (viewAxis === 'x') {
        // Side view from the right
        orthoCamera.position.set(wallCenterX + distance, wallCenterY, wallCenterZ)
        orthoCamera.lookAt(wallCenterX, wallCenterY, wallCenterZ)
      } else if (viewAxis === 'y') {
        // Front view
        orthoCamera.position.set(wallCenterX, wallCenterY, wallCenterZ + distance)
        orthoCamera.lookAt(wallCenterX, wallCenterY, wallCenterZ)
      } else {
        // Top view
        orthoCamera.position.set(wallCenterX, wallCenterY + distance, wallCenterZ)
        orthoCamera.lookAt(wallCenterX, wallCenterY, wallCenterZ)
      }

      isOrthoActiveRef.current = true
    },
    [wallDimensions]
  )

  const setCameraXView = useCallback(() => {
    setupOrthoCamera('x')
  }, [setupOrthoCamera])

  const setCameraYView = useCallback(() => {
    setupOrthoCamera('y')
  }, [setupOrthoCamera])

  const setCameraZView = useCallback(() => {
    setupOrthoCamera('z')
  }, [setupOrthoCamera])

  // Zoom orthographic camera by adjusting frustum size
  const zoomOrthoCamera = useCallback((delta: number) => {
    const orthoCamera = orthoCameraRef.current
    if (!orthoCamera || !isOrthoActiveRef.current) return

    const zoomSpeed = 0.1
    const zoomFactor = delta > 0 ? (1 + zoomSpeed) : (1 - zoomSpeed)
    
    // Scale the frustum
    const currentWidth = orthoCamera.right - orthoCamera.left
    const currentHeight = orthoCamera.top - orthoCamera.bottom
    
    // Limit zoom range
    const minSize = 100
    const maxSize = Math.max(wallDimensions.length, wallDimensions.height) * 3
    
    const newWidth = currentWidth * zoomFactor
    const newHeight = currentHeight * zoomFactor
    
    if (newWidth < minSize || newHeight < minSize) return
    if (newWidth > maxSize || newHeight > maxSize) return
    
    const centerX = (orthoCamera.left + orthoCamera.right) / 2
    const centerY = (orthoCamera.top + orthoCamera.bottom) / 2
    
    orthoCamera.left = centerX - newWidth / 2
    orthoCamera.right = centerX + newWidth / 2
    orthoCamera.top = centerY + newHeight / 2
    orthoCamera.bottom = centerY - newHeight / 2
    orthoCamera.updateProjectionMatrix()
  }, [wallDimensions])

  // Pan orthographic camera by moving its position
  const panOrthoCamera = useCallback((deltaX: number, deltaY: number) => {
    const orthoCamera = orthoCameraRef.current
    if (!orthoCamera || !isOrthoActiveRef.current) return

    // Calculate pan speed based on current frustum size
    const frustumWidth = orthoCamera.right - orthoCamera.left
    const panSpeed = frustumWidth * 0.001

    // Get camera's right and up vectors for proper panning
    const right = new THREE.Vector3()
    const up = new THREE.Vector3()
    right.setFromMatrixColumn(orthoCamera.matrix, 0)
    up.setFromMatrixColumn(orthoCamera.matrix, 1)

    // Calculate offset
    const offsetX = -deltaX * panSpeed
    const offsetY = deltaY * panSpeed

    // Apply offset to camera position
    orthoCamera.position.x += offsetX * right.x + offsetY * up.x
    orthoCamera.position.y += offsetX * right.y + offsetY * up.y
    orthoCamera.position.z += offsetX * right.z + offsetY * up.z
  }, [])

  // Reset to perspective view
  const resetToPerspective = useCallback(
    (zoomLevel: number) => {
      isOrthoActiveRef.current = false
      if (cameraRef.current) {
        positionCamera(cameraRef.current, wallDimensions, zoomLevel)
      }
    },
    [wallDimensions]
  )

  useEffect(() => {
    wallColorRef.current = wallColor
  }, [wallColor])

  const applyDimensions = useCallback(
    (newDimensions: WallDimensions, color?: string, zoomLevel = 1.5, preserveCamera = false) => {
      onDimensionsChange?.(newDimensions)

      if (!sceneRef.current) return

      const appliedColor = color ?? wallColorRef.current
      if (color) {
        wallColorRef.current = color
      }

      const nextBackWallLength =
        newDimensions.backWallLength ?? newDimensions.length

      createWall(newDimensions.height, nextBackWallLength, appliedColor)
      createFloor(nextBackWallLength)

      createLeftWall(
        newDimensions.height,
        newDimensions.leftWallLength ?? 600,
        newDimensions.leftWallVisible ?? true,
        appliedColor
      )

      createRightWall(
        newDimensions.height,
        newDimensions.rightWallLength ?? 600,
        nextBackWallLength,
        newDimensions.rightWallVisible ?? true,
        appliedColor
      )

      createAdditionalWalls(
        newDimensions.height,
        newDimensions.additionalWalls ?? [],
        appliedColor
      )

      if (cameraRef.current && !preserveCamera) {
        updateCameraPosition(
          newDimensions.height,
          nextBackWallLength,
          zoomLevel
        )
      }
    },
    [
      createAdditionalWalls,
      createFloor,
      createLeftWall,
      createRightWall,
      createWall,
      onDimensionsChange,
      updateCameraPosition,
    ]
  )

  useEffect(() => {
    if (!mountRef.current) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf0f0f0)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      50000
    )
    cameraRef.current = camera

    // Create orthographic camera for flat X/Y/Z views (optical infinity)
    const aspect = window.innerWidth / window.innerHeight
    const frustumSize = wallDimensions.length * 1.2
    const orthoCamera = new THREE.OrthographicCamera(
      -frustumSize / 2 * aspect,
      frustumSize / 2 * aspect,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      50000
    )
    orthoCameraRef.current = orthoCamera

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    rendererRef.current = renderer

    mountRef.current.appendChild(renderer.domElement)

    const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(5000, 5000, 5000)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    scene.add(directionalLight)

    const gridHelper = new THREE.GridHelper(2000, 20, 0x888888, 0xcccccc)
    gridHelper.position.set(1000, 0, 1000)
    scene.add(gridHelper)

    const axesHelper = new THREE.AxesHelper(1000)
    scene.add(axesHelper)

    // Create back wall (using length for backward compatibility, but should use backWallLength)
    const backWallLength = wallDimensions.backWallLength ?? wallDimensions.length
    createWall(wallDimensions.height, backWallLength, wallColor)
    createFloor(backWallLength)
    
    // Create left and right walls
    createLeftWall(
      wallDimensions.height,
      wallDimensions.leftWallLength ?? 600,
      wallDimensions.leftWallVisible ?? true,
      wallColor
    )
    createRightWall(
      wallDimensions.height,
      wallDimensions.rightWallLength ?? 600,
      backWallLength,
      wallDimensions.rightWallVisible ?? true,
      wallColor
    )
    
    // Create additional walls
    createAdditionalWalls(
      wallDimensions.height,
      wallDimensions.additionalWalls ?? [],
      wallColor
    )
    
    positionCamera(camera, { height: wallDimensions.height, length: backWallLength }, 1.5)

    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current) return
      const newAspect = window.innerWidth / window.innerHeight
      
      // Update perspective camera
      cameraRef.current.aspect = newAspect
      cameraRef.current.updateProjectionMatrix()
      
      // Update orthographic camera if it exists
      if (orthoCameraRef.current) {
        const ortho = orthoCameraRef.current
        const currentFrustumHeight = ortho.top - ortho.bottom
        ortho.left = -currentFrustumHeight / 2 * newAspect
        ortho.right = currentFrustumHeight / 2 * newAspect
        ortho.updateProjectionMatrix()
      }
      
      rendererRef.current.setSize(window.innerWidth, window.innerHeight)
    }

    window.addEventListener("resize", handleResize)

    // Animation loop via Three.js - uses active camera (ortho or perspective)
    const renderLoop = () => {
      if (rendererRef.current && sceneRef.current) {
        const activeCamera = isOrthoActiveRef.current 
          ? orthoCameraRef.current 
          : cameraRef.current
        if (activeCamera) {
          rendererRef.current.render(sceneRef.current, activeCamera)
        }
      }
    }
    renderer.setAnimationLoop(renderLoop)

    return () => {
      window.removeEventListener("resize", handleResize)
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement)
      }
      // Stop Three.js animation loop before disposing
      renderer.setAnimationLoop(null)
      renderer.dispose()

      if (sceneRef.current && wallRef.current)
        sceneRef.current.remove(wallRef.current)
      if (sceneRef.current && leftWallRef.current)
        sceneRef.current.remove(leftWallRef.current)
      if (sceneRef.current && rightWallRef.current)
        sceneRef.current.remove(rightWallRef.current)
      additionalWallsRef.current.forEach((wallGroup) => {
        sceneRef.current?.remove(wallGroup)
      })
      if (sceneRef.current && floorRef.current)
        sceneRef.current.remove(floorRef.current)
      if (sceneRef.current && floorGridRef.current)
        sceneRef.current.remove(floorGridRef.current)
      sceneRef.current = null
    }
  }, [mountRef])

  return {
    sceneRef,
    rendererRef,
    cameraRef,
    orthoCameraRef,
    isOrthoActiveRef,
    wallRef,
    leftWallRef,
    rightWallRef,
    additionalWallsRef,
    floorRef,
    floorGridRef,
    createWall,
    createLeftWall,
    createRightWall,
    createAdditionalWalls,
    createFloor,
    updateCameraPosition,
    resetCamera,
    resetToPerspective,
    zoomOrthoCamera,
    panOrthoCamera,
    setCameraXView,
    setCameraYView,
    setCameraZView,
    applyDimensions,
  }
}
