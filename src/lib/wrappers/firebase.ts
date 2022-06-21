/* eslint-disable import/no-unresolved */
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
/* eslint-enable import/no-unresolved */
import { credential } from 'firebase-admin'
import path from 'path'

import config from '../../app.config'

export const Collections = {
  trades: config.TRADES_COLLECTION,
}

const getFirebaseConfigPath = () => {
  const envArg = process.argv[2]
  const ENV = envArg.split('=')[1]

  if (ENV !== 'prod' && ENV !== 'dev') {
    throw Error('Missing ENV environment variable')
  }

  const firebaseConfigFilePath = path.join(__dirname, `../../../firebase-admin-credentials.${ENV}.json`)
  return firebaseConfigFilePath
}

const app = initializeApp({
  credential: credential.cert(getFirebaseConfigPath()),
  databaseURL: `https://${config.FIREBASE_PROJECT_ID}.europe-west1.firebasedatabase.app`,
})
const database = getFirestore(app)

export const saveDocument = async (collectionName: string, id: string, document: any) => {
  const docRef = database.doc(`${collectionName}/${id}`)
  await docRef.set(document)
}

type FirebaseDocumentData = {
  oldAmount: number
  newAmount: number
  profit: number
  type: 'redeem'
  wasSuccessful: boolean
  executedAt: Date
}

export const createFirebaseDocumentData = (
  preArbitrageUiBalance: number,
  postArbitrageUiBalance: number,
  success: boolean,
): FirebaseDocumentData => {
  const profitBps = postArbitrageUiBalance / preArbitrageUiBalance - 1
  return {
    oldAmount: preArbitrageUiBalance,
    newAmount: postArbitrageUiBalance,
    wasSuccessful: success,
    profit: Number(profitBps.toFixed(4)),
    type: 'redeem',
    executedAt: new Date(),
  }
}
