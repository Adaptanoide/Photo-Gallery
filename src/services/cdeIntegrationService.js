// services/cdeIntegrationService.js
const axios = require('axios');

exports.sendOrderToCDE = async (orderData) => {
  try {
    // Formatar dados no formato que o CDE espera
    const formattedData = {
      pedido_id: orderData.orderId,
      cliente: orderData.customerName,
      data_pedido: new Date().toISOString(),
      status: orderData.status,
      pasta_id: orderData.folderId,
      pasta_nome: orderData.folderName,
      categorias: []
    };
    
    // Processar fotos por categoria
    for (const categoryName in orderData.photosByCategory) {
      const categoryPhotos = orderData.photosByCategory[categoryName];
      
      formattedData.categorias.push({
        nome: categoryName,
        fotos: categoryPhotos.map(photo => ({
          id: photo.id,
          nome: photo.name
        }))
      });
    }
    
    // Adicionar token de segurança
    formattedData.security_token = process.env.CDE_SECURITY_TOKEN;
    
    // Enviar para o CDE
    const response = await axios.post(
      process.env.CDE_ENDPOINT_URL,
      formattedData,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 segundos
      }
    );
    
    console.log(`Dados enviados para CDE. Resposta: ${response.status}`);
    return {
      success: true,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    console.error('Erro ao enviar dados para CDE:', error);
    return {
      success: false,
      error: error.message
    };
  }
};