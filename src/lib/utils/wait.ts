export const wait = async (time = 200): Promise<void> => new Promise((resolve) => {
  setTimeout(() => {
    resolve()
  }, time)
})
