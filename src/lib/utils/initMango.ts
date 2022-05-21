import { IDS, MangoClient, Config } from '@blockworks-foundation/mango-client'
import { PublicKey, Connection } from '@solana/web3.js'

import appConfig from '../../app.config'

const MANGO_GROUP = 'mainnet.1'

export const initMangoGroup = async (connection: Connection) => {
  const config = new Config(IDS)
  const groupConfig = config.getGroup(appConfig.CLUSTER, MANGO_GROUP)
  if (!groupConfig) {
    throw new Error('Unable to get mango group config')
  }
  const mangoGroupKey = groupConfig.publicKey
  const clusterData = IDS.groups.find((g) => g.name === MANGO_GROUP && g.cluster === appConfig.CLUSTER)
  const mangoProgramIdPk = new PublicKey(clusterData!.mangoProgramId)

  const client = new MangoClient(connection, mangoProgramIdPk)
  const mangoGroup = await client.getMangoGroup(mangoGroupKey)
  return mangoGroup
}
