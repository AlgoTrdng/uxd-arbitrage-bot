import { wait } from './wait'

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
      await wait(waitTime)
    }
  } while (err)

  return res as Data
}
