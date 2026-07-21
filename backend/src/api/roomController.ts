import type { Request, Response } from 'express'
import type { Server } from 'socket.io'
import { toRoomSnapshot } from '../rooms/roomFactory'
import * as roomService from '../services/roomService'
import { getUserById } from '../modules/user/userStore'
import { canAfford, getWallet } from '../modules/wallet/walletService'
import { areFriends } from '../modules/friend/friendService'
import { broadcastLobbyUpdate, emitRoomInvite } from '../sockets/emit'
import { sendFail, sendOk } from '../util/http'

// The controller sequences room lifecycle (roomService) and money (walletService);
// neither service reaches into the other (spec §5.2–5.4).

// Push the fresh open-room list to every lobby subscriber after a change. io is
// stashed on the app at bootstrap; guard in case it's absent (e.g. under a test).
function pushLobby(req: Request): void {
  const io = req.app.get('io') as Server | undefined
  if (io) broadcastLobbyUpdate(io)
}

export function listRoomsHandler(_req: Request, res: Response): void {
  sendOk(res, { rooms: roomService.listVisibleRooms().map(toRoomSnapshot) })
}

export function getRoomHandler(req: Request, res: Response): void {
  const room = roomService.get(req.params.roomId)
  if (!room) {
    sendFail(res, 'Room not found', 404)
    return
  }
  sendOk(res, { room: toRoomSnapshot(room) })
}

export function createRoomHandler(req: Request, res: Response): void {
  const userId = req.userId as string
  const { name, gameId, betCoin, maxPlayers } = req.body as {
    name: string
    gameId: string
    betCoin: number
    maxPlayers: number
  }

  // Must be able to cover one full bet (their worst-case loss) — but nothing is
  // charged now; coins only move when the game settles.
  if (!canAfford(userId, 'coin', betCoin)) {
    sendFail(res, 'Not enough coins.', 402)
    return
  }
  const user = getUserById(userId)
  if (!user) {
    sendFail(res, 'Authentication required', 401)
    return
  }

  const result = roomService.create(userId, user.displayName, { name, gameId, betCoin, maxPlayers })
  if (!result.ok) {
    sendFail(res, result.error, result.code)
    return
  }
  pushLobby(req) // new room now open
  sendOk(res, { room: toRoomSnapshot(result.data), wallet: getWallet(userId) }, 201)
}

export function joinRoomHandler(req: Request, res: Response): void {
  const userId = req.userId as string
  const roomId = req.params.roomId

  const room = roomService.get(roomId)
  if (!room) {
    sendFail(res, 'Room not found', 404)
    return
  }
  const alreadySeated = room.players.some((p) => p.playerId === userId)
  const willTakeSeat = !alreadySeated && room.players.length < room.maxPlayers
  // Only a seat needs covering the bet (worst-case loss). A spectator (full room)
  // pays nothing. No charge now regardless — coins move when the game settles.
  if (willTakeSeat && !canAfford(userId, 'coin', room.betCoin)) {
    sendFail(res, 'Not enough coins.', 402)
    return
  }
  const user = getUserById(userId)
  if (!user) {
    sendFail(res, 'Authentication required', 401)
    return
  }

  const result = roomService.join(roomId, userId, user.displayName)
  if (!result.ok) {
    sendFail(res, result.error, result.code)
    return
  }
  if (result.data.newSeat) pushLobby(req) // occupancy changed
  sendOk(res, { room: toRoomSnapshot(result.data.room), wallet: getWallet(userId), role: result.data.role })
}

// Invite a friend into the room you're in — fires a real-time `room:invite` at
// them (they get a slide-in confirm card). Just a notification: they join through
// the normal flow, which re-checks everything. Works mid-game and when full — the
// friend joins an open seat (playing the next match) or watches as a spectator,
// same as walking up from the lobby.
export function inviteToRoomHandler(req: Request, res: Response): void {
  const inviterId = req.userId as string
  const roomId = req.params.roomId
  const { userId: targetId } = req.body as { userId: string }

  const room = roomService.get(roomId)
  if (!room) {
    sendFail(res, 'Room not found', 404)
    return
  }
  if (!room.players.some((p) => p.playerId === inviterId)) {
    sendFail(res, 'You are not in this room.', 403)
    return
  }
  if (targetId === inviterId) {
    sendFail(res, 'You cannot invite yourself.', 400)
    return
  }
  if (!areFriends(inviterId, targetId)) {
    sendFail(res, 'You can only invite friends.', 403)
    return
  }
  if (room.players.some((p) => p.playerId === targetId)) {
    sendFail(res, 'They are already in the room.', 409)
    return
  }

  const io = req.app.get('io') as Server | undefined
  if (io) {
    emitRoomInvite(io, targetId, {
      roomId,
      roomName: room.name,
      betCoin: room.betCoin,
      from: { id: inviterId, name: getUserById(inviterId)?.displayName ?? 'A friend' },
    })
  }
  sendOk(res, { sent: true })
}

export function leaveRoomHandler(req: Request, res: Response): void {
  const userId = req.userId as string
  const result = roomService.leave(req.params.roomId, userId)
  if (!result.ok) {
    sendFail(res, result.error, result.code)
    return
  }
  pushLobby(req) // room emptied or a seat freed
  sendOk(res, { room: result.data ? toRoomSnapshot(result.data) : null })
}
