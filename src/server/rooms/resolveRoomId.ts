import { getWsRooms } from "@/server/getWsRooms"

export async function resolveRoomIdByUrl(roomUrl: string): Promise<string> {
  if (!roomUrl) {
    throw new Error("roomUrl is required to resolve a room id")
  }

  const wsRooms = await getWsRooms()

  if (wsRooms.rooms?.[roomUrl]) {
    return roomUrl
  }

  const match = Object.entries(wsRooms.rooms ?? {}).find(
    ([, room]) => room.url === roomUrl
  )

  if (!match) {
    throw new Error(`roomUrl not found: ${roomUrl}`)
  }

  return match[0]
}
