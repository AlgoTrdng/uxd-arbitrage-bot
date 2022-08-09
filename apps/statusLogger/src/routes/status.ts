import { app } from '../clients/fastify'
import { appIds, state } from '../state'

app.route({
  method: 'POST',
  url: '/status',
  schema: {
    body: {
      type: 'object',
      properties: {
        appId: { type: 'string', enum: appIds },
        state: { type: 'string', enum: ['ping', 'startArb', 'endArb'] },
      },
      required: ['appId', 'state'],
    } as const,
  },
  handler: async (req) => {
    const { appId, state: appState } = req.body
    const ts = new Date().getTime()

    state.set(appId, {
      lastUpdatedMs: ts,
      state: appState === 'startArb' ? 'In arbitrage' : 'Scanning',
    })

    return { success: true }
  },
})
