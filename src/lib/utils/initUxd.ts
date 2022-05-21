import { Connection } from '@solana/web3.js'
import {
  WSOL,
  SOL_DECIMALS,
  USDC,
  USDC_DECIMALS,
  MangoDepository,
  createAndInitializeMango,
  UXDClient,
  Controller,
  UXD_DECIMALS,
} from '@uxd-protocol/uxd-client'

import config from '../../app.config'
import { program } from '../constants'

export const initUxd = async (connection: Connection) => {
  const controller = new Controller('UXD', UXD_DECIMALS, program.UXD)
  const uxdMango = await createAndInitializeMango(connection, config.CLUSTER as 'mainnet')
  const depository = new MangoDepository(WSOL, 'SOL', SOL_DECIMALS, USDC, 'USDC', USDC_DECIMALS, program.UXD)
  const client = new UXDClient(program.UXD)

  return {
    controller,
    uxdMango,
    depository,
    client,
  }
}
