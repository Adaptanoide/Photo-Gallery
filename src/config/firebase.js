// firebase.js
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Caminho para o arquivo de credenciais do Firebase
const FIREBASE_CREDENTIALS_PATH = path.join(__dirname, '../../firebase-credentials.json');

// Inicializar Firebase Admin SDK
function initializeFirebase() {
  try {
    const content = fs.readFileSync(FIREBASE_CREDENTIALS_PATH);
    const serviceAccount = JSON.parse(content);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    
    console.log('Firebase Admin SDK inicializado com sucesso');
    return admin.firestore();
  } catch (error) {
    console.error('Erro ao inicializar Firebase Admin SDK:', error);
    throw error;
  }
}

const db = initializeFirebase();

module.exports = { db, admin };