// controllers.js
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// Configurar autenticação do Google Drive
const SCOPES = ['https://www.googleapis.com/auth/drive'];
const CREDENTIALS_PATH = path.join(__dirname, '../../credentials.json');

let drive = null;

async function initializeDrive() {
  try {
    const content = fs.readFileSync(CREDENTIALS_PATH);
    const credentials = JSON.parse(content);
    
    const auth = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      SCOPES
    );
    
    drive = google.drive({ version: 'v3', auth });
    console.log('Google Drive API inicializada com sucesso');
    return drive;
  } catch (error) {
    console.error('Erro ao inicializar Google Drive API:', error);
    throw error;
  }
}

async function getDriveInstance() {
  if (!drive) {
    await initializeDrive();
  }
  return drive;
}

module.exports = { getDriveInstance, initializeDrive };