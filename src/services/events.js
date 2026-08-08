// Socket event-name mirror — MUST stay in sync with backend/src/types/events.ts.
// Never inline a socket event string literal anywhere else in the frontend.

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
}

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
}
