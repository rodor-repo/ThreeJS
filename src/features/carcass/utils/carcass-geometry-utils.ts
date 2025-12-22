import * as THREE from "three"
import type { PartDimension } from "../builders/CabinetBuilder"

/**
 * Extracts dimensions from a BoxGeometry mesh safely
 * Returns null if geometry is not a BoxGeometry
 */
export function extractBoxDimensions(
  mesh: THREE.Mesh
): { width: number; height: number; depth: number } | null {
  const geometry = mesh.geometry
  if (!(geometry instanceof THREE.BoxGeometry)) {
    console.warn("extractBoxDimensions: geometry is not a BoxGeometry")
    return null
  }
  return {
    width: geometry.parameters.width,
    height: geometry.parameters.height,
    depth: geometry.parameters.depth,
  }
}

/**
 * Creates a PartDimension from a mesh with BoxGeometry
 * Returns null if extraction fails
 */
export function createPartDimension(
  partName: string,
  mesh: THREE.Mesh
): PartDimension | null {
  const dims = extractBoxDimensions(mesh)
  if (!dims) return null
  return {
    partName,
    dimX: dims.width,
    dimY: dims.height,
    dimZ: dims.depth,
  }
}

// /**
//  * Creates multiple PartDimensions from an array of parts
//  * Filters out any that fail to extract
//  */
// export function createPartDimensions(
//   parts: Array<{ name: string, mesh: THREE.Mesh }>
// ): PartDimension[] {
//   return parts
//     .map(({ name, mesh }) => createPartDimension(name, mesh))
//     .filter((dim): dim is PartDimension => dim !== null)
// }

/**
 * Default wood material configuration
 */
const DEFAULT_WOOD_MATERIAL_CONFIG = {
  color: 0x8b4513, // Brown color for wood
  transparent: true,
  opacity: 0.9,
}

/**
 * Creates a mesh with shadow casting enabled
 */
export function createMesh(
  geometry: THREE.BufferGeometry,
  material?: THREE.Material
): THREE.Mesh {
  const meshMaterial =
    material || new THREE.MeshLambertMaterial(DEFAULT_WOOD_MATERIAL_CONFIG)

  const mesh = new THREE.Mesh(geometry, meshMaterial)
  mesh.castShadow = true
  mesh.receiveShadow = true

  return mesh
}

/**
 * Creates a wireframe for a given geometry
 */
export function createWireframe(
  geometry: THREE.BufferGeometry
): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(geometry)
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x333333 })
  return new THREE.LineSegments(edges, lineMaterial)
}

/**
 * Creates a group containing a mesh and its wireframe
 */
export function createMeshGroup(
  geometry: THREE.BufferGeometry,
  material?: THREE.Material
): { group: THREE.Group; mesh: THREE.Mesh; wireframe: THREE.LineSegments } {
  const mesh = createMesh(geometry, material)
  const wireframe = createWireframe(geometry)

  const group = new THREE.Group()
  group.add(mesh)
  group.add(wireframe)

  return { group, mesh, wireframe }
}

/**
 * Updates the geometry of a mesh and its wireframe
 * Disposes old geometries properly
 */
export function updateMeshGeometry(
  mesh: THREE.Mesh,
  group: THREE.Group,
  newGeometry: THREE.BufferGeometry
): void {
  // Dispose old mesh geometry
  mesh.geometry.dispose()
  mesh.geometry = newGeometry

  // Update wireframe (assumed to be the second child)
  group.children.forEach((child, index) => {
    if (index === 1 && child instanceof THREE.LineSegments) {
      child.geometry.dispose()
      const newEdges = new THREE.EdgesGeometry(newGeometry)
      child.geometry = newEdges
    }
  })
}

/**
 * Disposes a mesh and all its materials
 */
export function disposeMesh(mesh: THREE.Mesh): void {
  mesh.geometry.dispose()
  if (mesh.material) {
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((mat) => mat.dispose())
    } else {
      mesh.material.dispose()
    }
  }
}

/**
 * Disposes all children in a group (meshes and line segments)
 */
export function disposeGroup(group: THREE.Group): void {
  group.children.forEach((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
      if (child.geometry) {
        child.geometry.dispose()
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat: THREE.Material) => mat.dispose())
        } else {
          child.material.dispose()
        }
      }
    }
  })
}

/**
 * Disposes a complete carcass part (mesh + group)
 */
export function disposeCarcassPart(mesh: THREE.Mesh, group: THREE.Group): void {
  disposeMesh(mesh)
  disposeGroup(group)
}
