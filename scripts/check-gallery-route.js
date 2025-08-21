// PRECISAMOS ADICIONAR EM src/routes/gallery.js

// Quando buscar fotos, FILTRAR as reservadas:

const photos = await R2Service.listPhotos(prefix);

// ADICIONAR FILTRO:
const PhotoStatus = require('../models/PhotoStatus');

// Buscar fotos reservadas
const reservedPhotos = await PhotoStatus.find({
    'virtualStatus.status': { $in: ['reserved', 'sold'] }
}).select('photoId fileName');

// Criar Set para lookup rápido
const reservedSet = new Set(reservedPhotos.map(p => p.fileName));

// Filtrar fotos
const availablePhotos = photos.filter(photo => {
    return !reservedSet.has(photo.fileName);
});

// Retornar apenas disponíveis
res.json({ photos: availablePhotos });
