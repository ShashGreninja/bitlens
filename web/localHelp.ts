import type { Connect } from 'vite'
import { helpConversation, openAIHelp } from '../src/helpProvider'

export function localHelp(key?: string, model?: string): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (req.url !== '/__bitlens/help') return next()
    const respond = (status: number, answer: string | null = null) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify({ answer }))
    }
    if (req.method !== 'POST') return respond(405)
    const host = req.headers.host
    if (!host || !/^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host) ||
        req.headers.origin !== `http://${host}` ||
        !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? ''))
      return respond(403)
    if (!key) return respond(200)
    let conversation
    try {
      const chunks: Buffer[] = []
      let bytes = 0
      for await (const chunk of req) {
        bytes += chunk.length
        if (bytes > 24_000) return respond(413)
        chunks.push(chunk)
      }
      const { question, view, history } = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      conversation = helpConversation(question, view, history)
    } catch {
      return respond(400)
    }
    try {
      respond(200, await openAIHelp(conversation, key, model))
    } catch {
      respond(502)
    }
  }
}
