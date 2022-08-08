import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { credential } from 'firebase-admin'

import { Direction } from '../core/jupiter'
import { secrets } from '../config'

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
  profitBps: number
  direction: Direction
}

type ArbResultDbDocument = {
  executedAt: Date
  newAmount: number
  oldAmount: number
  profit: number
  type: Direction
}

export const saveArbResult = async ({
  newAmount,
  oldAmount,
  profitBps,
  direction,
}: ArbResultParams) => {
  const executedAt = new Date()
  const docRef = database.doc(
    `${secrets.FB_COLLECTION_NAME}/${executedAt.getTime().toString()}`,
  )
  const document: ArbResultDbDocument = {
    profit: profitBps,
    type: direction,
    executedAt,
    newAmount,
    oldAmount,
  }
  await docRef.set(document)
}
