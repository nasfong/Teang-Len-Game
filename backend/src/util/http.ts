import type { Response } from 'express'

// The response envelope (spec §11) — every REST reply goes through these.
export function sendOk<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ ok: true, data })
}

export function sendFail(res: Response, error: string, status: number): void {
  res.status(status).json({ ok: false, error })
}
