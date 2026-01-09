require('dotenv').config();
const mongoose = require('mongoose');

async function findSelectionWithPhotos() {
    await mongoose.connect(process.env.MONGODB_URI);
    const Selection = mongoose.model('Selection', new mongoose.Schema({}, { strict: false }));

    const photoNumbers = ['29170', '29202', '08223', '28639', '31462', '31452', '32344', '35528', '35529', '36517', '36520'];

    console.log('=== PROCURANDO SELEÇÃO COM ESTAS FOTOS ===\n');

    const selections = await Selection.find({}).sort({ createdAt: -1 }).limit(20);

    let found = false;
    for (const sel of selections) {
        const matchingPhotos = sel.items.filter(item => {
            if (!item.fileName) return false;
            const match = item.fileName.match(/(\d+)/);
            if (!match) return false;
            const photoNum = match[0];
            return photoNumbers.includes(photoNum);
        });

        if (matchingPhotos.length > 0) {
            found = true;
            console.log('\n✅ SELEÇÃO ENCONTRADA!');
            console.log('ID:', sel._id);
            console.log('Client Code:', sel.clientCode);
            console.log('Status:', sel.status);
            console.log('Created:', new Date(sel.createdAt).toLocaleString());
            console.log('Confirmed:', sel.confirmedAt ? new Date(sel.confirmedAt).toLocaleString() : 'N/A');
            console.log('Total Items:', sel.items.length);
            console.log('PO Number:', sel.poNumber || 'N/A');
            console.log('\nFotos RETIRADO encontradas:', matchingPhotos.length);
            matchingPhotos.forEach((item, i) => {
                const match = item.fileName.match(/(\d+)/);
                const photoNum = match ? match[0] : 'Unknown';
                console.log('  ' + (i+1) + '. ' + item.fileName + ' (Photo: ' + photoNum + ')');
            });
            console.log('\n---\n');
        }
    }

    if (!found) {
        console.log('\n❌ Nenhuma seleção encontrada com estas fotos nos últimos 20 registros');
    }

    await mongoose.connection.close();
}

findSelectionWithPhotos().catch(console.error);
