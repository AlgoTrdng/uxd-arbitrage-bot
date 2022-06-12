import config from '../../app.config'

const messageSigns = {
  REDEMPTION: '🔥',
  SWAP: '💱',
  STATUS: '📶',
}

export const logger = (type: keyof typeof messageSigns, message: string) => {
  if (config.log) {
    console.log(`${messageSigns[type]} - ${type}: ${message}`)
  }
}

export const logArbitrageStatus = (oldAmount: number, newAmount: number, profitPercentage: number, success: boolean) => {
  const message = `Executed arbitrage; status: ${
    success
  }, profit: ${
    profitPercentage
  }, oldAmount: ${
    oldAmount
  }, newAmount: ${
    newAmount
  }`
  console.log(message)
}
