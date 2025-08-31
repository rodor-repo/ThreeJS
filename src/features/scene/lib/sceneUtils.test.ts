import * as THREE from "three"
import { describe, it, expect } from "vitest"
import {
  buildWall,
  buildFloor,
  positionCamera,
  lookAtWallCenter,
  getWallCenter,
} from "./sceneUtils"

describe("sceneUtils", () => {
  const dims = { height: 2400, length: 3600 }

  it("buildWall returns a group positioned at wall center", () => {
    const group = buildWall(dims, "#ffffff")
    expect(group).toBeInstanceOf(THREE.Group)
    expect(group.children.length).toBeGreaterThan(0)

    const center = getWallCenter(dims)
    // Find the mesh (first child) and verify its position matches center
    const mesh = group.children.find((c) => (c as any).isMesh) as THREE.Mesh
    expect(mesh).toBeDefined()
    expect(mesh.position.x).toBeCloseTo(center.x)
    expect(mesh.position.y).toBeCloseTo(center.y)
    expect(mesh.position.z).toBeCloseTo(center.z)
  })

  it("buildFloor returns floor and grid centered under wall", () => {
    const { floor, grid } = buildFloor(dims.length)
    expect((floor as any).isMesh).toBe(true)
    expect((grid as any).isObject3D).toBe(true)
    // floor is rotated as a plane on X, positioned at +length/2 x/z
    expect(floor.position.x).toBeCloseTo(dims.length / 2)
    expect(floor.position.z).toBeCloseTo(dims.length / 2)
  })

  it("positionCamera places camera in front of wall and looks near center", () => {
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 10000)
    positionCamera(camera, dims, 1.5)
    const center = getWallCenter(dims)
    expect(camera.position.z).toBeGreaterThan(center.z)
    // After calling lookAtWallCenter, ensure direction updates cleanly
    lookAtWallCenter(camera, dims)
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    // Direction should roughly point towards negative Z (toward wall center)
    expect(dir.z).toBeLessThan(0)
  })
})
