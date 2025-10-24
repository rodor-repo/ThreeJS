import * as THREE from 'three';

/**
 * Disposes a material or array of materials
 */
export function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    material.forEach(mat => mat.dispose());
  } else {
    material.dispose();
  }
}

/**
 * Disposes a mesh and its materials
 */
export function disposeMesh(mesh: THREE.Mesh): void {
  if (mesh.geometry) {
    mesh.geometry.dispose();
  }
  if (mesh.material) {
    disposeMaterial(mesh.material);
  }
}

/**
 * Disposes a line segments object (wireframe) and its materials
 */
export function disposeLineSegments(lineSegments: THREE.LineSegments): void {
  if (lineSegments.geometry) {
    lineSegments.geometry.dispose();
  }
  if (lineSegments.material) {
    disposeMaterial(lineSegments.material);
  }
}

/**
 * Disposes all children in a group
 * Handles both Mesh and LineSegments children
 */
export function disposeGroup(group: THREE.Group): void {
  group.children.forEach(child => {
    if (child instanceof THREE.Mesh) {
      disposeMesh(child);
    } else if (child instanceof THREE.LineSegments) {
      disposeLineSegments(child);
    }
  });
}

/**
 * Disposes a mesh group created by meshUtils
 * This is a convenience function that disposes both mesh and group
 */
export function disposeMeshAndGroup(mesh: THREE.Mesh, group: THREE.Group): void {
  disposeMesh(mesh);
  disposeGroup(group);
}
