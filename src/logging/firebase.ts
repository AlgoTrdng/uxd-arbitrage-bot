import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { credential } from 'firebase-admin'

import { Direction } from '../core/jupiter'
import { secrets } from '../config'
import { round } from '../helpers/amount'

const parseFirebaseAdminCredentials = () => ({
  projectId: secrets.FB_PROJECT_ID,
  privateKey: secrets.FB_PRIVATE_KEY.replaceAll(',', '\n'),
  clientEmail: secrets.FB_CLIENT_EMAIL,
})

const app = initializeApp({
  credential: credential.cert(parseFirebaseAdminCredentials()),
  databaseURL: `https://${secrets.FB_PROJECT_ID}.europe-west1.firebasedatabase.app`,
})
const database = getFirestore(app)

type ArbResultParams = {
  newAmount: number
  oldAmount: number
  direction: Direction
}

type Trade = {
  executedAt: Date
  postArbAmount: number
  profit: number
  type: Direction
}

export const saveArbResult = (() => {
  let lastId: number | null = null

  return async ({
    newAmount,
    oldAmount,
    direction,
  }: ArbResultParams) => {
    const collectionRef = database.collection('uxd-arb-data')

    if (!lastId) {
      const lastInserted = await collectionRef.orderBy('startTimestamp', 'desc').limit(1).get()
      if (lastInserted) {
        lastId = Number(lastInserted.docs[0].id)
      }
    }

    const executedAt = new Date()
    const currentId = new Date(
      executedAt.getFullYear(),
      executedAt.getMonth(),
      executedAt.getDate(),
    )

    const profit = round(newAmount - oldAmount, 6)
    const trade: Trade = {
      postArbAmount: newAmount,
      type: direction,
      executedAt,
      profit,
    }

    if (currentId.getTime() !== lastId) {
      await collectionRef.doc(currentId.getTime().toString()).set({
        startBalance: oldAmount,
        startTimestamp: currentId,
        totalProfit: profit,
        totalTrades: 1,
        trades: [trade],
      })
      lastId = currentId.getTime()
      return
    }

    const docRef = collectionRef.doc(lastId.toString())
    await docRef.update({
      totalTrades: FieldValue.increment(1),
      totalProfit: FieldValue.increment(profit),
      trades: FieldValue.arrayUnion(trade),
    })
  }
})()
