// Single source of truth for socket event names (spec §2). The frontend keeps a
// mirror copy (src/net/events.js) that MUST stay in sync. Never inline a socket
// event string literal anywhere else.

export const CLIENT_EVENTS = {
  LOBBY_SUBSCRIBE: 'lobby:subscribe',
  LOBBY_UNSUBSCRIBE: 'lobby:unsubscribe',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_QUEUE_LEAVE: 'room:queue-leave',
  ROOM_CANCEL_QUEUE_LEAVE: 'room:cancel-queue-leave',
  PLAYER_READY: 'player:ready',
  GAME_START: 'game:start',
  GAME_PLAY: 'game:play',
  GAME_SKIP: 'game:skip',
} as const

export const SERVER_EVENTS = {
  LOBBY_UPDATE: 'lobby:update',
  ROOM_UPDATE: 'room:update',
  GAME_UPDATE: 'game:update',
  TURN_UPDATE: 'turn:update',
  TURN_TIMEOUT: 'turn:timeout',
  PLAYER_FINISHED: 'player:finished',
  GAME_END: 'game:end',
  PLAYER_DISCONNECTED: 'player:disconnected',
  FRIENDS_UPDATE: 'friends:update',
  ROOM_INVITE: 'room:invite',
  ERROR: 'error',
} as const

// The built-in socket lifecycle event, kept here so it isn't inlined either.
export const CONNECTION = 'connection'
export const DISCONNECT = 'disconnect'

// The Socket.IO room every lobby viewer joins, so a single emit fans the open-room
// list out to exactly the clients watching the lobby (not players inside a game).
export const LOBBY_ROOM = 'lobby'

// Each authenticated socket also joins a private room named for its user, so the
// server can push friend-list changes (a request arriving, a confirm, a friend
// coming online) straight to that one person across all their tabs/devices.
export const userRoom = (userId: string): string => `user:${userId}`
