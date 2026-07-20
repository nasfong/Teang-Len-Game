import type { NextFunction, Request, Response } from 'express'
import type { ZodTypeAny } from 'zod'

type Target = 'body' | 'params' | 'query'

// Zod-parse the target, REPLACE it with the parsed (coerced/defaulted) value, and
// forward any ZodError to the terminal error handler (spec §5.1).
export const validate =
  (schema: ZodTypeAny, target: Target = 'body') =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req[target])
    if (!parsed.success) {
      next(parsed.error)
      return
    }
    ;(req as unknown as Record<Target, unknown>)[target] = parsed.data
    next()
  }
