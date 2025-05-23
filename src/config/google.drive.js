// config/google.drive.js
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });

const { google } = require('googleapis');

// Configurar autenticação do Google Drive
const SCOPES = ['https://www.googleapis.com/auth/drive'];
const CREDENTIALS_PATH = path.join(__dirname, '../../credentials.json');

let drive = null;

async function initializeDrive() {
  try {
    // Tentar obter credenciais da variável de ambiente primeiro
    let credentials;
    
    if (process.env.GOOGLE_CREDENTIALS) {
      try {
        // Usar credenciais da variável de ambiente
        console.log('Usando credenciais do Google Drive a partir da variável de ambiente');
        credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      } catch (error) {
        console.error('Erro ao analisar credenciais de ambiente:', error);
        throw error;
      }
    } else {
      // Fallback para arquivo local (em desenvolvimento)
      console.log('Tentando usar credenciais de arquivo local');
      try {
        const content = fs.readFileSync(CREDENTIALS_PATH);
        credentials = JSON.parse(content);
      } catch (error) {
        console.error('Erro ao carregar credenciais locais:', error);
        throw error;
      }
    }
    
    // Verificar se temos credenciais válidas
    if (!credentials || !credentials.client_email || !credentials.private_key) {
      throw new Error('Credenciais do Google Drive incompletas ou inválidas');
    }
    
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