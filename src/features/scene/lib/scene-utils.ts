import * as THREE from "three"
import _ from "lodash"

export type WallDimensions = {
  height: number
  length: number
}

export const WALL_THICKNESS = 90

export const getWallCenter = (dims: WallDimensions) => {
  const x = dims.length / 2
  const y = dims.height / 2
  const z = -WALL_THICKNESS / 2
  return new THREE.Vector3(x, y, z)
}

export const buildWall = (dims: WallDimensions, color: string = "#dcbfa0") => {
  const group = new THREE.Group()

  const geometry = new THREE.BoxGeometry(
    dims.length,
    dims.height,
    WALL_THICKNESS
  )
  const material = new THREE.MeshLambertMaterial({
    color: _.defaultTo(color, "#dcbfa0"),
    transparent: true,
    opacity: 0.9,
  })

  const wall = new THREE.Mesh(geometry, material)
  const center = getWallCenter(dims)
  wall.position.copy(center)
  wall.castShadow = true
  wall.receiveShadow = true
  group.add(wall)

  const edges = new THREE.EdgesGeometry(geometry)
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x666666 })
  const wireframe = new THREE.LineSegments(edges, lineMaterial)
  wireframe.position.copy(center)
  group.add(wireframe)

  return group
}

export const buildFloor = (wallLength: number) => {
  const floorWidth = wallLength
  const floorDepth = wallLength

  const geometry = new THREE.PlaneGeometry(floorWidth, floorDepth, 600, 600)
  const material = new THREE.MeshLambertMaterial({
    color: 0x1e3a8a,
    transparent: true,
    opacity: 0,
    wireframe: true,
  })

  const floor = new THREE.Mesh(geometry, material)
  floor.rotation.x = -Math.PI / 2
  floor.position.set(floorWidth / 2, 0, floorDepth / 2)
  floor.receiveShadow = true

  const grid = new THREE.GridHelper(
    floorDepth,
    Math.floor(floorDepth / 100),
    0xcccccc,
    0xe0e0e0
  )
  grid.position.set(floorWidth / 2, 0.1, floorDepth / 2)

  return { floor, grid }
}

export const positionCamera = (
  camera: THREE.PerspectiveCamera,
  dims: WallDimensions,
  zoomLevel: number
) => {
  const wallCenter = getWallCenter(dims)
  const distance = zoomLevel * dims.length
  const cameraY = dims.height * 0.625

  camera.position.set(wallCenter.x, cameraY, wallCenter.z + distance)

  const angleRadians = (15 * Math.PI) / 180
  const lookAtY = cameraY - distance * Math.tan(angleRadians)
  camera.lookAt(wallCenter.x, lookAtY, wallCenter.z)
}

export const lookAtWallCenter = (
  camera: THREE.PerspectiveCamera,
  dims: WallDimensions
) => {
  const c = getWallCenter(dims)
  camera.lookAt(c.x, c.y, c.z)
}
