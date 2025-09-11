// check-photos-in-r2.js
const R2Service = require('./src/services/R2Service');

async function checkR2() {
    const photoNumbers = ["11998", "12008", "14785", "14806", "10629", "10609", "10703", "10710"];
    
    console.log('📸 VERIFICANDO FOTOS NO R2:\n');
    
    for (const photoNum of photoNumbers) {
        try {
            // Tentar encontrar em qualquer categoria
            const allPhotos = await R2Service.listPhotos('/');
            const found = allPhotos.photos.find(p => 
                p.fileName.includes(photoNum) || 
                p.key.includes(photoNum)
            );
            
            if (found) {
                console.log(`${photoNum}: EXISTE no R2`);
                console.log(`  Path: ${found.key}`);
                console.log(`  Categoria: ${found.category}`);
            } else {
                console.log(`${photoNum}: NÃO encontrada no R2`);
            }
        } catch (error) {
            console.log(`${photoNum}: Erro ao buscar`);
        }
    }
}

checkR2();