import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'

// Terminal error handler (spec §11). Zod → 400 with a readable message; anything
// else → 500. Never leaks stack traces or socketId.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    const message = err.issues.map((i) => i.message).join('; ') || 'Invalid request'
    res.status(400).json({ ok: false, error: message })
    return
  }
  // eslint-disable-next-line no-console
  console.error('[error]', err)
  res.status(500).json({ ok: false, error: 'Internal server error' })
}
