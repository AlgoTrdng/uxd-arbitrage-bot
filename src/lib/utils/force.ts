import { wait } from './wait'

type OnErrorConfig<T> = {
  cb?: () => Promise<T>
  wait?: number
}

/**
 * Retry throwable function until it successfully returns.
 * If `wait` is provided, will wait on Error provided amount of ms, before retrying
 */
export const force = async <SuccessData>
(
  cb: () => Promise<SuccessData>,
  onErrorConfig?: OnErrorConfig<SuccessData>,
) => {
  try {
    const res = await cb.call(null)
    return res
  } catch (error) {
    let res: any

    if (onErrorConfig?.wait) {
      await wait(onErrorConfig.wait)
    }

    if (onErrorConfig?.cb) {
      res = await onErrorConfig.cb.call(null)
      return res as Awaited<SuccessData>
    }

    res = await cb.call(null)
    return res as Awaited<SuccessData>
  }
}
