import config from '../../app.config'

const messageSigns = {
  REDEMPTION: '🔥',
  SWAP: '💱',
  STATUS: '📶',
}

export const logger = (type: keyof typeof messageSigns, message: string) => {
  if (config.LOG) {
    console.log(`${messageSigns[type]} - ${type}: ${message}`)
  }
}
