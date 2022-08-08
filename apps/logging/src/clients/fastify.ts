import fastify from 'fastify'
import helmet from '@fastify/helmet'
import { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts'

import { secrets } from '../config'

const app = fastify().withTypeProvider<JsonSchemaToTsProvider>()

app.register(helmet)

app.addHook('onRequest', async (req) => {
  const authHeaderKey = 'x-authentication-token'
  if (
    !(authHeaderKey in req.headers)
    || typeof req.headers[authHeaderKey] !== 'string'
  ) {
    // eslint-disable-next-line no-throw-literal
    throw {
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid authentication token',
    }
  }

  const token = req.headers[authHeaderKey]
  const secret = secrets.TOKEN_SECRET

  const isCorrect = secret === token
  if (!isCorrect) {
    // eslint-disable-next-line no-throw-literal
    throw {
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid authentication token',
    }
  }
})

export { app }
