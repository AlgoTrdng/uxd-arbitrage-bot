/* eslint-disable import/no-unresolved */
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
/* eslint-enable import/no-unresolved */
import { credential } from 'firebase-admin'

import appConfig from '../../../app.config'
import { AppStatuses, ArbitrageType } from '../../../state'

const parseFirebaseAdminCredentials = () => ({
  projectId: appConfig.FB_project_id,
  privateKey: appConfig.FB_private_key,
  clientEmail: appConfig.FB_client_email,
})

const app = initializeApp({
  credential: credential.cert(parseFirebaseAdminCredentials()),
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
  type: ArbitrageType
}

const firebaseArbTypes = {
  [AppStatuses.MINTING]: 'mint',
  [AppStatuses.REDEEMING]: 'redeem',
}

export const saveToFirebase = async ({
  postArbitrageUiBalance,
  preArbitrageUiBalance,
  profitBps,
  type,
}: SaveToFirebaseConfig) => {
  const firebaseType = firebaseArbTypes[type]
  const executedAt = new Date()
  const firebaseDocumentData = {
    oldAmount: preArbitrageUiBalance,
    newAmount: postArbitrageUiBalance,
    wasSuccessful: true,
    profit: Number(profitBps.toFixed(4)),
    type: firebaseType,
    executedAt,
  }

  await saveDocument(
    appConfig.TRADES_COLLECTION,
    executedAt.getTime().toString(),
    firebaseDocumentData,
  )
}
