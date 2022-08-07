import { setTimeout } from 'timers/promises'

export const forceOnError = async <Data>(
  cb: () => Promise<Data>,
  waitTime = 200,
) => {
  let err = false
  let res: Data | null = null

  do {
    try {
      err = false
      res = await cb()
    } catch (error) {
      err = true
      await setTimeout(waitTime)
    }
  } while (err)

  return res as Data
}
