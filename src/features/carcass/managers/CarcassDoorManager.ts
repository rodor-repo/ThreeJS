import { CarcassAssembly } from "../CarcassAssembly"
import { CarcassDoor } from "../parts/CarcassDoor"
import { calculateDoorDimensions } from "../utils/carcass-dimension-utils"
import { DoorMaterial } from "../DoorMaterial"

export class CarcassDoorManager {
  private assembly: CarcassAssembly
  public doors: CarcassDoor[] = []

  constructor(assembly: CarcassAssembly) {
    this.assembly = assembly
  }

  public createDoors(): void {
    this.doors = []
    const config = this.assembly.config

    if (config.doorEnabled) {
      const doorDepth = this.assembly.dimensions.depth
      const doorGap = 2
      const thickness = config.material.getThickness()

      const doorDimensions = calculateDoorDimensions(
        this.assembly.dimensions.width,
        this.assembly.dimensions.height,
        doorGap,
        config.doorCount || 1
      )

      if (config.doorCount === 2) {
        // Left door
        const leftDoor = new CarcassDoor({
          width: doorDimensions.width,
          height: doorDimensions.height,
          depth: doorDepth,
          thickness: thickness,
          material: config.doorMaterial!,
          position: "left",
          offset: 2,
          carcassWidth: this.assembly.dimensions.width,
          overhang: this.assembly.cabinetType === "top" ? config.overhangDoor || false : false,
        })

        // Right door
        const rightDoor = new CarcassDoor({
          width: doorDimensions.width,
          height: doorDimensions.height,
          depth: doorDepth,
          thickness: thickness,
          material: config.doorMaterial!,
          position: "right",
          offset: 2,
          carcassWidth: this.assembly.dimensions.width,
          overhang: this.assembly.cabinetType === "top" ? config.overhangDoor || false : false,
        })

        this.doors.push(leftDoor, rightDoor)
      } else {
        // Single door
        const door = new CarcassDoor({
          width: doorDimensions.width,
          height: doorDimensions.height,
          depth: doorDepth,
          thickness: thickness,
          material: config.doorMaterial!,
          position: "center",
          offset: 2,
          carcassWidth: this.assembly.dimensions.width,
          overhang: this.assembly.cabinetType === "top" ? config.overhangDoor || false : false,
        })

        this.doors.push(door)
      }
    }
  }

  public updateDoors(): void {
    const config = this.assembly.config
    if (config.doorEnabled && this.doors.length > 0) {
      const doorDepth = this.assembly.dimensions.depth
      const doorGap = 2
      const thickness = config.material.getThickness()

      const doorDimensions = calculateDoorDimensions(
        this.assembly.dimensions.width,
        this.assembly.dimensions.height,
        doorGap,
        config.doorCount || 1
      )

      this.doors.forEach((door) => {
        door.updateDimensions(
          doorDimensions.width,
          doorDimensions.height,
          doorDepth,
          thickness
        )
        door.updateCarcassWidth(this.assembly.dimensions.width)
      })
    }
  }

  public toggleDoors(enabled: boolean): void {
    const config = this.assembly.config
    config.doorEnabled = enabled

    if (enabled) {
      if (this.doors.length === 0) {
        this.createDoors()
        this.assembly.addPartsToGroup(this.doors)
      }
    } else {
      this.assembly.removePartsFromGroup(this.doors)
      this.doors.forEach((door) => door.dispose())
      this.doors = []
    }
  }

  public updateDoorConfiguration(
    doorCount: number,
    doorMaterial?: DoorMaterial
  ): void {
    const config = this.assembly.config
    config.doorCount = doorCount
    if (doorMaterial) {
      config.doorMaterial = doorMaterial
    }

    if (config.doorEnabled) {
      this.assembly.removePartsFromGroup(this.doors)
      this.doors.forEach((door) => door.dispose())
      this.doors = []

      this.createDoors()
      this.assembly.addPartsToGroup(this.doors)
    }
  }

  public updateOverhangDoor(overhang: boolean): void {
    if (this.assembly.cabinetType !== "top") return

    this.assembly.config.overhangDoor = overhang

    if (this.assembly.config.doorEnabled && this.doors.length > 0) {
      this.doors.forEach((door) => {
        door.updateOverhang(overhang)
      })
    }
  }

  public updateDoorMaterial(doorMaterial: DoorMaterial): void {
    this.assembly.config.doorMaterial = doorMaterial
    this.doors.forEach((door) => {
      door.updateMaterial(doorMaterial)
    })
  }
  
  public dispose(): void {
      this.doors.forEach(d => d.dispose())
      this.doors = []
  }
}

