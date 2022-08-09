export const updateWindow = 1000 * 60 * 5
export const appIds = ['UXD-arb_dev', 'UXD-arb_prod'] as const

export type AppStatus = {
  lastUpdatedMs: number
  state: string
}

export const state = new Map<typeof appIds[number], AppStatus | null>(
  appIds.map((id) => ([id, null])),
)
