import http from 'node:http'
import cors from 'cors'
import express from 'express'
import { Server } from 'socket.io'
import { config } from './config'
import { buildApiRouter } from './api/router'
import { errorHandler } from './middleware/errorHandler'
import { registerSocketHandlers } from './sockets'

// Express app + HTTP + Socket.IO bootstrap (spec §2, §6.1).
const app = express()
app.use(cors({ origin: config.clientOrigin }))
app.use(express.json())

// Liveness (spec §5).
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'teang-len-backend', ts: Date.now() })
})

app.use('/api', buildApiRouter())
app.use(errorHandler) // terminal — must be last

const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: config.clientOrigin },
  pingTimeout: 10_000,
  pingInterval: 5_000,
})
registerSocketHandlers(io)
// Hand the io instance to the REST layer (req.app.get('io')) so room controllers
// can broadcast lobby updates after a create/join/leave.
app.set('io', io)

server.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[teang-len] REST + Socket.IO listening on :${config.port}`)
})
