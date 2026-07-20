import type { Request, Response } from 'express'
import type { Server } from 'socket.io'
import {
  acceptRequest,
  getFriendState,
  removeFriend,
  removePending,
  searchToAdd,
  sendRequest,
  type FriendState,
} from '../modules/friend/friendService'
import type { ServiceResult } from '../types'
import { emitFriendsUpdate } from '../sockets/emit'
import { sendFail, sendOk } from '../util/http'

// Friends REST — search users to add, list your friends + pending requests (with
// live status), and drive the request flow. userId always comes from the verified
// token (req.userId), never the body.
//
// The acting user gets their fresh state back in the HTTP response; the OTHER
// party (and any of the actor's other tabs) get it pushed over the socket, so a
// request/confirm/cancel/remove shows up on both sides in real time.

// Every mutation returns the same fresh { friends, incoming, outgoing } snapshot.
function reply(req: Request, res: Response, result: ServiceResult<FriendState>, alsoNotify: string): void {
  if (!result.ok) {
    sendFail(res, result.error, result.code)
    return
  }
  const io = req.app.get('io') as Server | undefined
  if (io) {
    emitFriendsUpdate(io, req.userId as string) // actor's other tabs
    emitFriendsUpdate(io, alsoNotify) // the other party
  }
  sendOk(res, result.data)
}

export function searchUsersHandler(req: Request, res: Response): void {
  const q = String((req.query as { q?: string }).q ?? '')
  sendOk(res, { results: searchToAdd(req.userId as string, q) })
}

export function friendStateHandler(req: Request, res: Response): void {
  sendOk(res, getFriendState(req.userId as string))
}

export function sendRequestHandler(req: Request, res: Response): void {
  const { userId } = req.body as { userId: string }
  reply(req, res, sendRequest(req.userId as string, userId), userId)
}

export function acceptRequestHandler(req: Request, res: Response): void {
  const fromId = req.params.userId
  reply(req, res, acceptRequest(req.userId as string, fromId), fromId)
}

export function removePendingHandler(req: Request, res: Response): void {
  const otherId = req.params.userId
  reply(req, res, removePending(req.userId as string, otherId), otherId)
}

export function removeFriendHandler(req: Request, res: Response): void {
  const friendId = req.params.friendId
  reply(req, res, removeFriend(req.userId as string, friendId), friendId)
}
