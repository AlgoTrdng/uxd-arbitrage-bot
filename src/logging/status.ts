import fetch from 'node-fetch'
import { secrets } from '../config'

const STATUS_API_URL = `${secrets.STATUS_API}/status`

export const updateStatus = async (type: 'ping' | 'startArb') => {
  try {
    const appId = `UXD-arb_${process.env.APP_ENV === 'production' ? 'prod' : 'dev'}`
    await fetch(STATUS_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-authentication-token': secrets.STATUS_SECRET,
      },
      body: JSON.stringify({
        appId,
        type,
      }),
    })
  } catch (error) {
    console.error(error)
  }
}
