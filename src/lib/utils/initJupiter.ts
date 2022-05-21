import { Jupiter } from '@jup-ag/core'
import { Connection } from '@solana/web3.js'

import config from '../../app.config'

const { SOL_PRIVATE_KEY, CLUSTER } = config

export const initJupiter = async (connection: Connection) => (
  Jupiter.load({
    cluster: `${CLUSTER}-beta` as 'mainnet-beta',
    user: SOL_PRIVATE_KEY,
    connection,
  })
)
