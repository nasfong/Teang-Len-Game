// Augment Express's Request so requireAuth can attach the verified userId.
import 'express'

declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

export {}
