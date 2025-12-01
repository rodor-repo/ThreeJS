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

/**
 * Build a left wall (perpendicular to back wall, on the left side)
 * Left wall starts from negative X and finishes at origin point (X=0)
 * The length parameter is how far the wall extends in positive Z direction from the back wall
 * @param height Wall height
 * @param length Wall length (extends in positive Z direction from back wall)
 * @param color Wall color
 * @returns THREE.Group containing the wall mesh and wireframe
 */
export const buildLeftWall = (height: number, length: number, color: string = "#dcbfa0") => {
  const group = new THREE.Group()
  
  // Left wall extends in Z direction, positioned so it ends at X=0
  // The wall starts at Z=-WALL_THICKNESS (aligned with back of back wall) and extends forward by 'length' in positive Z
  const geometry = new THREE.BoxGeometry(
    WALL_THICKNESS,
    height,
    length + WALL_THICKNESS
  )
  const material = new THREE.MeshLambertMaterial({
    color: _.defaultTo(color, "#dcbfa0"),
    transparent: true,
    opacity: 0.9,
  })
  
  const wall = new THREE.Mesh(geometry, material)
  // Position: X center at -WALL_THICKNESS/2 (so right edge is at X=0), Y at center, Z center at (length - WALL_THICKNESS)/2
  wall.position.set(-WALL_THICKNESS / 2, height / 2, (length - WALL_THICKNESS) / 2)
  wall.castShadow = true
  wall.receiveShadow = true
  group.add(wall)
  
  const edges = new THREE.EdgesGeometry(geometry)
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x666666 })
  const wireframe = new THREE.LineSegments(edges, lineMaterial)
  wireframe.position.set(-WALL_THICKNESS / 2, height / 2, (length - WALL_THICKNESS) / 2)
  group.add(wireframe)
  
  return group
}

/**
 * Build a right wall (perpendicular to back wall, on the right side)
 * Right wall starts at the point where back wall finishes and extends by wall thickness
 * The length parameter is how far the wall extends in positive Z direction from the back wall
 * @param height Wall height
 * @param length Wall length (extends in positive Z direction from back wall)
 * @param backWallLength Length of the back wall (to position right wall starting at this point)
 * @param color Wall color
 * @returns THREE.Group containing the wall mesh and wireframe
 */
export const buildRightWall = (height: number, length: number, backWallLength: number, color: string = "#dcbfa0") => {
  const group = new THREE.Group()
  
  // Right wall extends in Z direction, positioned so it starts at X=backWallLength
  // The wall starts at Z=-WALL_THICKNESS (aligned with back of back wall) and extends forward by 'length' in positive Z
  const geometry = new THREE.BoxGeometry(
    WALL_THICKNESS,
    height,
    length + WALL_THICKNESS
  )
  const material = new THREE.MeshLambertMaterial({
    color: _.defaultTo(color, "#dcbfa0"),
    transparent: true,
    opacity: 0.9,
  })
  
  const wall = new THREE.Mesh(geometry, material)
  // Position: X center at backWallLength + WALL_THICKNESS/2 (so left edge is at X=backWallLength), Y at center, Z center at (length - WALL_THICKNESS)/2
  wall.position.set(backWallLength + WALL_THICKNESS / 2, height / 2, (length - WALL_THICKNESS) / 2)
  wall.castShadow = true
  wall.receiveShadow = true
  group.add(wall)
  
  const edges = new THREE.EdgesGeometry(geometry)
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x666666 })
  const wireframe = new THREE.LineSegments(edges, lineMaterial)
  wireframe.position.set(backWallLength + WALL_THICKNESS / 2, height / 2, (length - WALL_THICKNESS) / 2)
  group.add(wireframe)
  
  return group
}

/**
 * Build an additional wall (perpendicular to back wall, positioned at a distance from left)
 * @param height Wall height
 * @param length Wall length (extends in Z direction)
 * @param distanceFromLeft Distance from origin (X=0) in X direction
 * @param color Wall color
 * @param thickness Wall thickness (defaults to WALL_THICKNESS)
 * @returns THREE.Group containing the wall mesh and wireframe
 */
export const buildAdditionalWall = (height: number, length: number, distanceFromLeft: number, color: string = "#dcbfa0", thickness: number = WALL_THICKNESS) => {
  const group = new THREE.Group()
  
  // Additional wall extends in Z direction, positioned at distanceFromLeft from origin
  const geometry = new THREE.BoxGeometry(
    thickness,
    height,
    length + WALL_THICKNESS
  )
  const material = new THREE.MeshLambertMaterial({
    color: _.defaultTo(color, "#dcbfa0"),
    transparent: true,
    opacity: 0.9,
  })
  
  const wall = new THREE.Mesh(geometry, material)
  // Position: X at distanceFromLeft + thickness/2, Y at center, Z extends forward
  wall.position.set(distanceFromLeft + thickness / 2, height / 2, (length - WALL_THICKNESS) / 2)
  wall.castShadow = true
  wall.receiveShadow = true
  group.add(wall)
  
  const edges = new THREE.EdgesGeometry(geometry)
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x666666 })
  const wireframe = new THREE.LineSegments(edges, lineMaterial)
  wireframe.position.set(distanceFromLeft + thickness / 2, height / 2, (length - WALL_THICKNESS) / 2)
  group.add(wireframe)
  
  return group
}