import * as THREE from 'three'

/**
 * Simple Benchtop - just a single cube/box mesh
 * 
 * Dimensions:
 * - Length (X): Cabinet width + child filler/panel widths + left/right overhangs
 * - Thickness (Y): Fixed 38mm
 * - Depth (Z): Already includes front overhang (passed as total depth)
 * 
 * Position (relative to benchtop cabinet group position):
 * - The benchtop cabinet group is positioned at the cabinet's top-left-back corner
 * - This mesh extends from there toward +X, +Y, +Z
 * - Left overhang shifts the mesh toward -X
 * 
 * Note: The depth parameter already includes the front overhang.
 * Front overhang is stored separately for UI/tracking purposes only.
 * Left/Right overhangs ARE added to the length for geometry.
 */
export class Benchtop {
  public mesh: THREE.Mesh
  public length: number
  public thickness: number
  public depth: number  // Total depth including front overhang
  // Overhangs - stored for tracking/UI purposes
  public frontOverhang: number  // Stored but NOT added to depth (already included)
  public leftOverhang: number   // Added to length
  public rightOverhang: number  // Added to length

  constructor(
    length: number, 
    thickness: number, 
    depth: number,  // This depth ALREADY includes front overhang
    frontOverhang: number = 0,
    leftOverhang: number = 0,
    rightOverhang: number = 0
  ) {
    this.length = length
    this.thickness = thickness
    this.depth = depth  // Already includes front overhang
    this.frontOverhang = frontOverhang
    this.leftOverhang = leftOverhang
    this.rightOverhang = rightOverhang

    // Calculate total length (left/right overhangs extend beyond cabinet)
    // Depth already includes front overhang - don't add again
    const totalLength = length + leftOverhang + rightOverhang
    const totalDepth = depth  // Already includes front overhang

    // Create simple box geometry
    const geometry = new THREE.BoxGeometry(totalLength, thickness, totalDepth)

    // Create simple material - light laminate color
    const material = new THREE.MeshLambertMaterial({
      color: 0xd4a574,
    })

    // Create mesh
    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true

    // Position mesh so its corner aligns with origin
    // BoxGeometry is centered, so offset by half dimensions
    // Left overhang shifts the mesh toward -X
    this.mesh.position.set(
      totalLength / 2 - leftOverhang,
      thickness / 2,
      totalDepth / 2
    )
  }

  public updateDimensions(
    length: number, 
    thickness: number, 
    depth: number,  // This depth ALREADY includes front overhang
    frontOverhang?: number,
    leftOverhang?: number,
    rightOverhang?: number
  ): void {
    this.length = length
    this.thickness = thickness
    this.depth = depth  // Already includes front overhang
    
    if (frontOverhang !== undefined) this.frontOverhang = frontOverhang
    if (leftOverhang !== undefined) this.leftOverhang = leftOverhang
    if (rightOverhang !== undefined) this.rightOverhang = rightOverhang

    // Calculate total length (left/right overhangs extend beyond cabinet)
    // Depth already includes front overhang - don't add again
    const totalLength = length + this.leftOverhang + this.rightOverhang
    const totalDepth = depth  // Already includes front overhang

    // Dispose old geometry
    this.mesh.geometry.dispose()

    // Create new geometry
    this.mesh.geometry = new THREE.BoxGeometry(totalLength, thickness, totalDepth)

    // Update position - left overhang shifts toward -X
    this.mesh.position.set(
      totalLength / 2 - this.leftOverhang,
      thickness / 2,
      totalDepth / 2
    )
  }

  public dispose(): void {
    this.mesh.geometry.dispose()
    if (this.mesh.material) {
      if (Array.isArray(this.mesh.material)) {
        this.mesh.material.forEach(m => m.dispose())
      } else {
        (this.mesh.material as THREE.Material).dispose()
      }
    }
  }
}
