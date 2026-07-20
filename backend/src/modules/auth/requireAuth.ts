import type { NextFunction, Request, Response } from 'express'
import { verifyToken } from './token'

// Extract `Bearer <token>`, verify it, attach the derived userId to the request
// (spec §3.1). Rejects with 401 in the standard envelope. All room/user/wallet
// routes sit behind this.
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ ok: false, error: 'Authentication required' })
    return
  }
  const userId = verifyToken(header.slice('Bearer '.length).trim())
  if (!userId) {
    res.status(401).json({ ok: false, error: 'Invalid or expired token' })
    return
  }
  req.userId = userId
  next()
}
