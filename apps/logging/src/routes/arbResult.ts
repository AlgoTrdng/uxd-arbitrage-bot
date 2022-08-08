import { app } from '../clients/fastify'

app.route({
  method: 'POST',
  url: '/arb-result',
  schema: {
    body: {
      type: 'object',
      properties: {
        preArbBalanceUi: { type: 'number' },
        postArbBalanceUi: { type: 'number' },
        direction: { type: 'string', enum: ['mint', 'redemption'] },
      },
      required: ['preArbBalanceUi'],
    } as const,
  },
  handler: async (req, res) => {
    return req.body
  },
})
