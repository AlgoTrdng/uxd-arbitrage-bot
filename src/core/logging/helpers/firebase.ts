/* eslint-disable import/no-unresolved */
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
/* eslint-enable import/no-unresolved */
import { credential } from 'firebase-admin'
import path from 'path'

import appConfig from '../../../app.config'

const getFirebaseConfigPath = () => {
  const { APP_ENV } = process.env

  if (APP_ENV !== 'prod' && APP_ENV !== 'dev') {
    throw Error('Missing ENV environment variable')
  }

  const firebaseConfigFilePath = path.join(__dirname, `../../../../firebase-admin-credentials.${APP_ENV}.json`)
  return firebaseConfigFilePath
}

const app = initializeApp({
  credential: credential.cert(getFirebaseConfigPath()),
  databaseURL: `https://${appConfig.FIREBASE_PROJECT_ID}.europe-west1.firebasedatabase.app`,
})
const database = getFirestore(app)

export const saveDocument = async (collectionName: string, id: string, document: any) => {
  const docRef = database.doc(`${collectionName}/${id}`)
  await docRef.set(document)
}

type SaveToFirebaseConfig = {
  preArbitrageUiBalance: number
  postArbitrageUiBalance: number
  profitBps: number
}

export const saveToFirebase = async (config: SaveToFirebaseConfig) => {
  const { postArbitrageUiBalance, preArbitrageUiBalance, profitBps } = config

  const executedAt = new Date()
  const firebaseDocumentData = {
    oldAmount: preArbitrageUiBalance,
    newAmount: postArbitrageUiBalance,
    wasSuccessful: true,
    profit: Number(profitBps.toFixed(4)),
    type: 'redeem',
    executedAt,
  }

  await saveDocument(
    appConfig.TRADES_COLLECTION,
    executedAt.getTime().toString(),
    firebaseDocumentData,
  )
}
