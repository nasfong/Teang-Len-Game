import type { Request, Response } from 'express'
import { login, register } from '../modules/auth/authService'
import { sendFail, sendOk } from '../util/http'

// Bodies are already Zod-validated by the route's validate() middleware.
export function registerHandler(req: Request, res: Response): void {
  const result = register(req.body)
  if (!result.ok) {
    sendFail(res, result.error, result.code)
    return
  }
  sendOk(res, result.data, 201)
}

export function loginHandler(req: Request, res: Response): void {
  const result = login(req.body)
  if (!result.ok) {
    sendFail(res, result.error, result.code)
    return
  }
  sendOk(res, result.data)
}
