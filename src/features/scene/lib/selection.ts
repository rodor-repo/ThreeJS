import * as THREE from "three"

export const clearHighlight = (group: THREE.Group) => {
  group.traverse((child) => {
    if (child instanceof THREE.LineSegments) {
      const mat = child.material as THREE.LineBasicMaterial
      if ((mat as any).originalColor) {
        mat.color.copy((mat as any).originalColor)
      } else {
        mat.color.setHex(0x333333)
      }
      if ((mat as any).originalLinewidth !== undefined) {
        mat.linewidth = (mat as any).originalLinewidth
      } else {
        mat.linewidth = 1
      }
    }
    if (child instanceof THREE.Mesh && child.material) {
      const material = child.material as any
      if (material && material.color && material.originalColor) {
        material.color.copy(material.originalColor)
        material.isHighlighted = false
      }
    }
  })
}

export const highlightSelected = (group: THREE.Group) => {
  group.traverse((child) => {
    if (child instanceof THREE.LineSegments) {
      const mat = child.material as THREE.LineBasicMaterial
      ;(mat as any).originalColor =
        (mat as any).originalColor || mat.color.clone()
      ;(mat as any).originalLinewidth = mat.linewidth || 1
      mat.color.setHex(0x00ff00)
      mat.linewidth = 3
    }
    if (child instanceof THREE.Mesh && child.material) {
      const material = child.material as any
      // Guard against multiple applications when meshes share the same material instance
      if (material && material.color && !material.isHighlighted) {
        material.originalColor =
          material.originalColor || material.color.clone()
        material.color.multiplyScalar(1.5)
        material.isHighlighted = true
      }
    }
  })
}

export const pulseHover = (group: THREE.Group) => {
  group.traverse((child) => {
    if (child instanceof THREE.LineSegments) {
      const mat = child.material as THREE.LineBasicMaterial
      if (mat.color.getHex() === 0x00ff00) {
        mat.color.setHex(0x00ff88)
      }
    }
  })
}

export const unpulseHover = (group: THREE.Group) => {
  group.traverse((child) => {
    if (child instanceof THREE.LineSegments) {
      const mat = child.material as THREE.LineBasicMaterial
      if (mat.color.getHex() === 0x00ff88) {
        mat.color.setHex(0x00ff00)
      }
    }
  })
}
