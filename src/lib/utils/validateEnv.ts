export const validateEnv = (...envVariables: string[]) => {
  if (envVariables.some((envVar) => typeof envVar !== 'string' || !envVar.length)) {
    throw Error('Missing env variables')
  }
}
