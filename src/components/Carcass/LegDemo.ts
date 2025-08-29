import * as THREE from 'three';
import { CarcassAssembly } from './CarcassAssembly';

/**
 * Demo to showcase Leg functionality for Base and Tall cabinets
 * This demonstrates how Base and Tall cabinets have 4 legs positioned at the corners
 * with front legs set back by 70mm
 */
export class LegDemo {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private baseCabinet!: CarcassAssembly;
  private tallCabinet!: CarcassAssembly;
  private topCabinet!: CarcassAssembly;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    
    this.setupScene();
    this.setupLighting();
    this.createCabinets();
    this.setupCamera();
    this.animate();
    
    container.appendChild(this.renderer.domElement);
  }

  private setupScene(): void {
    this.scene.background = new THREE.Color(0xf0f0f0);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  private setupLighting(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);

    // Directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);
  }

  private createCabinets(): void {
    // Create a Base cabinet (should have 4 legs)
    this.baseCabinet = CarcassAssembly.createBaseCabinet({
      width: 600,
      height: 720,
      depth: 600
    });
    this.baseCabinet.group.position.set(-600, 0, 0);
    this.scene.add(this.baseCabinet.group);

    // Create a Tall cabinet (should have 4 legs)
    this.tallCabinet = CarcassAssembly.createTallCabinet({
      width: 600,
      height: 2000,
      depth: 600
    });
    this.tallCabinet.group.position.set(0, 0, 0);
    this.scene.add(this.tallCabinet.group);

    // Create a Top cabinet (should have no legs)
    this.topCabinet = CarcassAssembly.createTopCabinet({
      width: 600,
      height: 600,
      depth: 300
    });
    this.topCabinet.group.position.set(600, 0, 0);
    this.scene.add(this.topCabinet.group);

    // Add labels
    this.addLabels();
  }

  private addLabels(): void {
    // Base cabinet label
    const baseLabel = this.createTextLabel('Base Cabinet\n4 Legs (50mm diameter)', 0x3B82F6);
    baseLabel.position.set(-600, 800, 0);
    this.scene.add(baseLabel);

    // Tall cabinet label
    const tallLabel = this.createTextLabel('Tall Cabinet\n4 Legs (50mm diameter)', 0x10B981);
    tallLabel.position.set(0, 800, 0);
    this.scene.add(tallLabel);

    // Top cabinet label
    const topLabel = this.createTextLabel('Top Cabinet\nNo Legs', 0xEF4444);
    topLabel.position.set(600, 800, 0);
    this.scene.add(topLabel);

    // Add leg positioning info
    this.addLegInfo();
  }

  private addLegInfo(): void {
    // Leg positioning information
    const legInfo = this.createTextLabel(
      'Leg Specifications:\n' +
      '• 50mm diameter\n' +
      '• Black color\n' +
      '• 100mm height\n' +
      '• Front legs set back 70mm\n' +
      '• Only for Base and Tall cabinets',
      0x1E40AF
    );
    legInfo.position.set(0, 1200, 0);
    this.scene.add(legInfo);
  }

  private createTextLabel(text: string, color: number): THREE.Group {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 512;
    canvas.height = 256;
    
    context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    context.font = 'bold 24px Arial';
    context.textAlign = 'center';
    context.fillText(text, 256, 128);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    const geometry = new THREE.PlaneGeometry(4, 2);
    const mesh = new THREE.Mesh(geometry, material);
    
    const group = new THREE.Group();
    group.add(mesh);
    return group;
  }

  private setupCamera(): void {
    this.camera.position.set(0, 1000, 1500);
    this.camera.lookAt(0, 500, 0);
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());
    
    // Rotate cabinets slowly to show legs
    if (this.baseCabinet) {
      this.baseCabinet.group.rotation.y += 0.005;
    }
    if (this.tallCabinet) {
      this.tallCabinet.group.rotation.y += 0.005;
    }
    if (this.topCabinet) {
      this.topCabinet.group.rotation.y += 0.005;
    }
    
    this.renderer.render(this.scene, this.camera);
  }

  public resize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  public dispose(): void {
    if (this.baseCabinet) this.baseCabinet.dispose();
    if (this.tallCabinet) this.tallCabinet.dispose();
    if (this.topCabinet) this.topCabinet.dispose();
    
    this.renderer.dispose();
  }
}
