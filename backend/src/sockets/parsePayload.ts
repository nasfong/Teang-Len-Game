import type { Socket } from 'socket.io'
import type { z, ZodTypeAny } from 'zod'
import { SERVER_EVENTS } from '../types/events'

// Safe Zod parse for socket payloads (spec §6.1). On failure, emit `error` to the
// sender only and return null so the handler drops the message.
export function parsePayload<T extends ZodTypeAny>(socket: Socket, schema: T, payload: unknown): z.infer<T> | null {
  const result = schema.safeParse(payload)
  if (!result.success) {
    socket.emit(SERVER_EVENTS.ERROR, { message: 'Invalid payload' })
    return null
  }
  return result.data
}
