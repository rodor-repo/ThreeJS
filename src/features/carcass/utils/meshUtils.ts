import * as THREE from 'three';

/**
 * Default material configuration for carcass parts
 */
export interface DefaultMaterialConfig {
  color: number;
  transparent?: boolean;
  opacity?: number;
}

/**
 * Creates a mesh with default settings for carcass parts
 */
export function createMesh(
  geometry: THREE.BoxGeometry,
  material?: THREE.Material,
  defaultConfig?: DefaultMaterialConfig
): THREE.Mesh {
  const mat = material || new THREE.MeshLambertMaterial({
    color: defaultConfig?.color ?? 0x8B4513,
    transparent: defaultConfig?.transparent ?? true,
    opacity: defaultConfig?.opacity ?? 0.9
  });

  const mesh = new THREE.Mesh(geometry, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  
  return mesh;
}

/**
 * Creates a wireframe outline for a geometry
 */
export function createWireframe(geometry: THREE.BoxGeometry): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(geometry);
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x333333 });
  return new THREE.LineSegments(edges, lineMaterial);
}

/**
 * Creates a group containing a mesh and its wireframe
 */
export function createMeshGroup(
  geometry: THREE.BoxGeometry,
  material?: THREE.Material,
  defaultConfig?: DefaultMaterialConfig
): { group: THREE.Group; mesh: THREE.Mesh; wireframe: THREE.LineSegments } {
  const mesh = createMesh(geometry, material, defaultConfig);
  const wireframe = createWireframe(geometry);
  
  const group = new THREE.Group();
  group.add(mesh);
  group.add(wireframe);
  
  return { group, mesh, wireframe };
}

/**
 * Updates geometry for a mesh and its wireframe
 * Properly disposes old geometries before assigning new ones
 */
export function updateMeshGeometry(
  mesh: THREE.Mesh,
  group: THREE.Group,
  newGeometry: THREE.BoxGeometry
): void {
  // Dispose old geometry
  mesh.geometry.dispose();
  mesh.geometry = newGeometry;

  // Update wireframe (second child in group)
  group.children.forEach((child, index) => {
    if (index === 1 && child instanceof THREE.LineSegments) {
      child.geometry.dispose();
      const newEdges = new THREE.EdgesGeometry(newGeometry);
      child.geometry = newEdges;
    }
  });
}
