import { Connection } from '@solana/web3.js'

import { JupiterWrapper } from './jupiter'
import { MangoWrapper } from './mango'
import { UxdWrapper } from './uxd'

export type Wrappers = {
  jupiterWrapper: JupiterWrapper,
  uxdWrapper: UxdWrapper,
  mangoWrapper: MangoWrapper,
}

export const initWrappers = async (connection: Connection): Promise<Wrappers> => {
  const jupiterWrapper = await JupiterWrapper.init(connection)
  const uxdWrapper = await UxdWrapper.init(connection)
  const mangoWrapper = await MangoWrapper.init()

  return {
    jupiterWrapper,
    uxdWrapper,
    mangoWrapper,
  }
}
