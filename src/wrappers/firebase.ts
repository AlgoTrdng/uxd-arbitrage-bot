import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc } from 'firebase/firestore'

import config from '../app.config'

export const Collections = {
  trades: config.TRADES_COLLECTION,
  fails: config.REDEMPTION_FAILS_COLLECTION,
}

const app = initializeApp({
  apiKey: config.FIREBASE_API_KEY,
  authDomain: config.FIREBASE_AUTH_DOMAIN,
  projectId: config.FIREBASE_PROJECT_ID,
  storageBucket: config.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: config.FIREBASE_MESSAGING_SENDER_ID,
  appId: config.FIREBASE_APP_ID,
})
const database = getFirestore(app)

export const saveDocument = async (collectionName: string, id: string, document: any) => {
  const newDocumentReference = doc(database, collectionName, id)
  await setDoc(newDocumentReference, document)
}

type firebaseDocumentData = {
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
): firebaseDocumentData => {
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
