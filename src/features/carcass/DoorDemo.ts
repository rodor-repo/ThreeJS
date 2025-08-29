import * as THREE from "three"
import { CarcassAssembly } from "./CarcassAssembly"
import { DoorMaterial } from "./DoorMaterial"

export class DoorDemo {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private carcass: CarcassAssembly

  constructor(container: HTMLElement) {
    // Create scene
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0xf0f0f0)

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    )
    this.camera.position.set(1000, 1000, 1000)
    this.camera.lookAt(0, 0, 0)

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(this.renderer.domElement)

    // Add lights
    this.setupLights()

    // Create carcass with doors enabled
    this.carcass = CarcassAssembly.createBaseCabinet(
      { width: 600, height: 720, depth: 600 },
      {
        doorEnabled: true,
        doorMaterial: DoorMaterial.getDefaultMaterial(),
        doorCount: 1,
      }
    )

    // Add carcass to scene
    this.scene.add(this.carcass.group)

    // Add grid helper
    const gridHelper = new THREE.GridHelper(2000, 20)
    this.scene.add(gridHelper)

    // Start animation loop
    this.animate()

    // Handle window resize
    window.addEventListener("resize", () => this.onWindowResize())
  }

  private setupLights(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
    this.scene.add(ambientLight)

    // Directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(1000, 1000, 1000)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    this.scene.add(directionalLight)
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate())
    this.renderer.render(this.scene, this.camera)
  }

  private onWindowResize(): void {
    const container = this.renderer.domElement.parentElement
    if (container) {
      this.camera.aspect = container.clientWidth / container.clientHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(container.clientWidth, container.clientHeight)
    }
  }

  // Demo methods
  public toggleDoors(): void {
    const currentState = this.carcass.config.doorEnabled
    this.carcass.toggleDoors(!currentState)
    console.log(`Doors ${!currentState ? "enabled" : "disabled"}`)
  }

  public changeDoorCount(count: number): void {
    this.carcass.updateDoorConfiguration(count)
    console.log(`Door count changed to ${count}`)
  }

  public changeDoorMaterial(materialId: string): void {
    let doorMaterial: DoorMaterial

    switch (materialId) {
      case "glass":
        doorMaterial = new DoorMaterial({
          colour: "#87CEEB",
          thickness: 6,
          opacity: 0.3,
          transparent: true,
        })
        break
      case "thick":
        doorMaterial = new DoorMaterial({
          colour: "#ffffff",
          thickness: 25,
          opacity: 0.9,
          transparent: true,
        })
        break
      default:
        doorMaterial = DoorMaterial.getDefaultMaterial()
    }

    this.carcass.updateDoorMaterial(doorMaterial)
    console.log(`Door material changed to ${materialId}`)
  }

  public dispose(): void {
    this.carcass.dispose()
    this.renderer.dispose()
  }
}
