import { Router } from 'express'
import { requireAuth } from '../modules/auth/requireAuth'
import { validate } from '../middleware/validate'
import {
  createRoomSchema,
  friendIdParamSchema,
  friendRequestSchema,
  loginSchema,
  registerSchema,
  roomIdParamSchema,
  userIdParamSchema,
  userSearchSchema,
} from '../types/schemas'
import { loginHandler, registerHandler } from './authController'
import {
  acceptRequestHandler,
  friendStateHandler,
  removeFriendHandler,
  removePendingHandler,
  searchUsersHandler,
  sendRequestHandler,
} from './friendController'
import {
  createRoomHandler,
  getRoomHandler,
  inviteToRoomHandler,
  joinRoomHandler,
  leaveRoomHandler,
  listRoomsHandler,
} from './roomController'
import { getUserById, toPublicUser } from '../modules/user/userStore'
import { getWallet } from '../modules/wallet/walletService'
import { claimAdReward } from '../modules/rewards/rewardService'
import { listProducts } from '../modules/shop/shopCatalog'
import { sendFail, sendOk } from '../util/http'

// Mounts /auth, /users, /wallet, /rooms under /api (spec §5).
export function buildApiRouter(): Router {
  const api = Router()

  // Auth — no token required.
  api.post('/auth/register', validate(registerSchema), registerHandler)
  api.post('/auth/login', validate(loginSchema), loginHandler)

  // Everything below requires a valid Bearer token.
  api.get('/users/me', requireAuth, (req, res) => {
    const user = getUserById(req.userId as string)
    if (!user) {
      sendFail(res, 'Authentication required', 401)
      return
    }
    sendOk(res, { user: toPublicUser(user) })
  })

  api.get('/wallet', requireAuth, (req, res) => {
    sendOk(res, getWallet(req.userId as string))
  })

  // Shop catalog (mock) — products typed 'purchase' | 'ads'.
  api.get('/shop/products', requireAuth, (_req, res) => {
    sendOk(res, { products: listProducts() })
  })

  // Rewarded-video claim — server owns the amount + cooldown (spec §3.3).
  api.post('/rewards/ad', requireAuth, (req, res) => {
    const result = claimAdReward(req.userId as string)
    if (!result.ok) {
      sendFail(res, result.error, result.code)
      return
    }
    sendOk(res, result.data)
  })

  // Friends — search, list state (friends + pending requests), request flow, remove.
  // userId always comes from the token. Specific /friends/requests routes are
  // declared before the generic /friends/:friendId so they can't be shadowed.
  api.get('/users/search', requireAuth, validate(userSearchSchema, 'query'), searchUsersHandler)
  api.get('/friends', requireAuth, friendStateHandler)
  api.post('/friends/requests', requireAuth, validate(friendRequestSchema), sendRequestHandler)
  api.post(
    '/friends/requests/:userId/accept',
    requireAuth,
    validate(userIdParamSchema, 'params'),
    acceptRequestHandler,
  )
  api.delete('/friends/requests/:userId', requireAuth, validate(userIdParamSchema, 'params'), removePendingHandler)
  api.delete('/friends/:friendId', requireAuth, validate(friendIdParamSchema, 'params'), removeFriendHandler)

  api.get('/rooms', requireAuth, listRoomsHandler)
  api.post('/rooms', requireAuth, validate(createRoomSchema), createRoomHandler)
  api.get('/rooms/:roomId', requireAuth, validate(roomIdParamSchema, 'params'), getRoomHandler)
  api.post('/rooms/:roomId/join', requireAuth, validate(roomIdParamSchema, 'params'), joinRoomHandler)
  api.post(
    '/rooms/:roomId/invite',
    requireAuth,
    validate(roomIdParamSchema, 'params'),
    validate(friendRequestSchema),
    inviteToRoomHandler,
  )
  api.post('/rooms/:roomId/leave', requireAuth, validate(roomIdParamSchema, 'params'), leaveRoomHandler)

  return api
}
