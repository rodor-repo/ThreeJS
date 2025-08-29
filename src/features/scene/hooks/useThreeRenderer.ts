import { useEffect, useRef, useCallback } from "react"
import * as THREE from "three"
import {
  buildWall,
  buildFloor,
  positionCamera,
  WALL_THICKNESS,
} from "../lib/scene-utils"
import type { WallDimensions } from "../types"

export const useThreeRenderer = (
  mountRef: React.RefObject<HTMLDivElement>,
  wallDimensions: WallDimensions,
  wallColor: string
) => {
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const wallRef = useRef<THREE.Group | null>(null)
  const floorRef = useRef<THREE.Mesh | null>(null)
  const floorGridRef = useRef<THREE.GridHelper | null>(null)

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
      positionCamera(cameraRef.current, wallDimensions, zoomLevel)
    },
    [wallDimensions]
  )

  const setCameraXView = useCallback(() => {
    const camera = cameraRef.current
    if (!camera) return
    const wallCenterX = wallDimensions.length / 2
    const wallCenterY = wallDimensions.height / 2
    const wallCenterZ = -WALL_THICKNESS / 2
    const distance = wallDimensions.length * 1.5
    camera.position.set(
      wallDimensions.length + distance,
      wallCenterY,
      wallCenterZ
    )
    camera.lookAt(wallCenterX, wallCenterY, wallCenterZ)
  }, [wallDimensions])

  const setCameraYView = useCallback(() => {
    const camera = cameraRef.current
    if (!camera) return
    const wallCenterX = wallDimensions.length / 2
    const wallCenterY = wallDimensions.height / 2
    const wallCenterZ = -WALL_THICKNESS / 2
    const distance = wallDimensions.length * 1.5
    camera.position.set(wallCenterX, wallCenterY, wallCenterZ + distance)
    camera.lookAt(wallCenterX, wallCenterY, wallCenterZ)
  }, [wallDimensions])

  const setCameraZView = useCallback(() => {
    const camera = cameraRef.current
    if (!camera) return
    const wallCenterX = wallDimensions.length / 2
    const wallCenterY = wallDimensions.height / 2
    const wallCenterZ = -WALL_THICKNESS / 2
    const distance =
      Math.max(wallDimensions.length, wallDimensions.height) * 1.5
    camera.position.set(wallCenterX, wallCenterY + distance, wallCenterZ)
    camera.lookAt(wallCenterX, wallCenterY, wallCenterZ)
  }, [wallDimensions])

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

    createWall(wallDimensions.height, wallDimensions.length, wallColor)
    createFloor(wallDimensions.length)
    positionCamera(camera, wallDimensions, 1.5)

    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current) return
      cameraRef.current.aspect = window.innerWidth / window.innerHeight
      cameraRef.current.updateProjectionMatrix()
      rendererRef.current.setSize(window.innerWidth, window.innerHeight)
    }

    window.addEventListener("resize", handleResize)

    let frameId = 0
    const animate = () => {
      frameId = requestAnimationFrame(animate)
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current)
      }
    }
    animate()

    return () => {
      window.removeEventListener("resize", handleResize)
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement)
      }
      renderer.dispose()
      cancelAnimationFrame(frameId)

      if (sceneRef.current && wallRef.current)
        sceneRef.current.remove(wallRef.current)
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
    wallRef,
    floorRef,
    floorGridRef,
    createWall,
    createFloor,
    updateCameraPosition,
    resetCamera,
    setCameraXView,
    setCameraYView,
    setCameraZView,
  }
}
