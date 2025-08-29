import * as THREE from "three"
import { CarcassAssembly } from "./CarcassAssembly"
import { CarcassTop } from "./parts/CarcassTop"

/**
 * Demo to showcase Base Rail functionality for Base cabinets
 * This demonstrates how Base cabinets have a 60mm deep top rail instead of full carcass depth
 */
export class BaseRailDemo {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private baseCabinet!: CarcassAssembly
  private topCabinet!: CarcassAssembly

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
    this.renderer = new THREE.WebGLRenderer({ antialias: true })

    this.setupScene()
    this.setupLighting()
    this.createCabinets()
    this.setupCamera()
    this.animate()

    container.appendChild(this.renderer.domElement)
  }

  private setupScene(): void {
    this.scene.background = new THREE.Color(0xf0f0f0)
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
  }

  private setupLighting(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
    this.scene.add(ambientLight)

    // Directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(10, 10, 5)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    this.scene.add(directionalLight)
  }

  private createCabinets(): void {
    // Create a Base cabinet (should have 60mm Base Rail)
    this.baseCabinet = CarcassAssembly.createBaseCabinet({
      width: 600,
      height: 720,
      depth: 600,
    })
    this.baseCabinet.group.position.set(-400, 0, 0)
    this.scene.add(this.baseCabinet.group)

    // Create a Top cabinet (should have full depth top)
    this.topCabinet = CarcassAssembly.createTopCabinet({
      width: 600,
      height: 600,
      depth: 300,
    })
    this.topCabinet.group.position.set(400, 0, 0)
    this.scene.add(this.topCabinet.group)

    // Add labels
    this.addLabels()
  }

  private addLabels(): void {
    // Base cabinet label
    const baseLabel = this.createTextLabel(
      "Base Cabinet\nBase Rail: 60mm",
      0x3b82f6
    )
    baseLabel.position.set(-400, 800, 0)
    this.scene.add(baseLabel)

    // Top cabinet label
    const topLabel = this.createTextLabel(
      "Top Cabinet\nFull Depth Top",
      0x10b981
    )
    topLabel.position.set(400, 800, 0)
    this.scene.add(topLabel)

    // Add positioning info labels
    this.updatePositioningLabels()
  }

  private updatePositioningLabels(): void {
    // Remove existing positioning labels
    this.scene.children = this.scene.children.filter(
      (child) => !(child.userData && child.userData.isPositioningLabel)
    )

    // Add positioning info for Base cabinet
    if (this.baseCabinet) {
      const baseTop = (this.baseCabinet as any).top
      if (baseTop && baseTop.getPositioningInfo) {
        const baseInfo = this.createTextLabel(
          baseTop.getPositioningInfo(),
          0x1e40af
        )
        baseInfo.position.set(-400, 600, 0)
        baseInfo.userData = { isPositioningLabel: true }
        this.scene.add(baseInfo)
      }
    }

    // Add positioning info for Top cabinet
    if (this.topCabinet) {
      const topTop = (this.topCabinet as any).top
      if (topTop && topTop.getPositioningInfo) {
        const topInfo = this.createTextLabel(
          topTop.getPositioningInfo(),
          0x059669
        )
        topInfo.position.set(400, 600, 0)
        topInfo.userData = { isPositioningLabel: true }
        this.scene.add(topInfo)
      }
    }
  }

  private createTextLabel(text: string, color: number): THREE.Group {
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")!
    canvas.width = 256
    canvas.height = 128

    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, canvas.width, canvas.height)

    context.fillStyle = `#${color.toString(16).padStart(6, "0")}`
    context.font = "16px Arial"
    context.textAlign = "center"

    const lines = text.split("\n")
    lines.forEach((line, index) => {
      context.fillText(line, canvas.width / 2, 40 + index * 25)
    })

    const texture = new THREE.CanvasTexture(canvas)
    const material = new THREE.SpriteMaterial({ map: texture })
    const sprite = new THREE.Sprite(material)
    sprite.scale.set(200, 100, 1)

    const group = new THREE.Group()
    group.add(sprite)
    return group
  }

  private setupCamera(): void {
    this.camera.position.set(0, 500, 1000)
    this.camera.lookAt(0, 400, 0)
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate())

    // Rotate cabinets slowly to show the Base Rail difference
    this.baseCabinet.group.rotation.y += 0.005
    this.topCabinet.group.rotation.y += 0.005

    this.renderer.render(this.scene, this.camera)
  }

  public resize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  public dispose(): void {
    this.baseCabinet.dispose()
    this.topCabinet.dispose()
    this.renderer.dispose()
  }

  // Method to demonstrate Base Rail depth change
  public changeBaseRailDepth(newDepth: number): void {
    if (this.baseCabinet) {
      const top = (this.baseCabinet as any).top
      if (top && top.updateBaseRailSettings) {
        top.updateBaseRailSettings("base", newDepth)
        console.log(`Base Rail depth changed to ${newDepth}mm`)

        // Update positioning labels to show new information
        this.updatePositioningLabels()
      }
    }
  }
}
