// Test tree building logic

const cowhideBindingPhotos = [
    { qbItem: '5500BR', displayName: 'Cowhide Hair On BRA With Leather Binding And Lined → Brown & White', photoCount: 10 },
    { qbItem: '5500CH', displayName: 'Cowhide Hair On BRA With Leather Binding And Lined → Champagne', photoCount: 8 },
    { qbItem: '5500HF', displayName: 'Cowhide Hair On BRA With Leather Binding And Lined → Hereford', photoCount: 5 }
];

const sheepskinPhotos = [
    { qbItem: '8401', displayName: 'Sheepskins → Himalayan Exotic Tones', photoCount: 20 },
    { qbItem: '8101', displayName: 'Sheepskins → Tibetan Exotic Tones', photoCount: 15 }
];

// Simular criação de nó Leather Binding
const bindingNode = {
    name: 'Cowhide with Leather Binding',
    children: {},
    qbItem: cowhideBindingPhotos[0]?.qbItem || null,
    photoCount: cowhideBindingPhotos.reduce((sum, pc) => sum + pc.photoCount, 0)
};

// Adicionar children
for (const pc of cowhideBindingPhotos) {
    const segments = pc.displayName.split(' → ');
    if (segments.length > 1) {
        const colorName = segments[1];
        bindingNode.children[colorName] = {
            name: colorName,
            qbItem: pc.qbItem,
            photoCount: pc.photoCount
        };
    }
}

console.log('LEATHER BINDING:');
console.log('  Parent QB:', bindingNode.qbItem);
console.log('  Children:', Object.keys(bindingNode.children).length);
Object.entries(bindingNode.children).forEach(([key, child]) => {
    console.log(`    - ${key}: QB ${child.qbItem}`);
});

console.log('');

// Sheepskins
const sheepskinNode = {
    name: 'Sheepskins',
    children: {},
    qbItem: sheepskinPhotos[0]?.qbItem || null,
    photoCount: sheepskinPhotos.reduce((sum, pc) => sum + pc.photoCount, 0)
};

for (const pc of sheepskinPhotos) {
    const segments = pc.displayName.split(' → ');
    if (segments.length > 1) {
        const name = segments[1];
        sheepskinNode.children[name] = {
            name: name,
            qbItem: pc.qbItem,
            photoCount: pc.photoCount
        };
    }
}

console.log('SHEEPSKINS:');
console.log('  Parent QB:', sheepskinNode.qbItem, '<- Same as first child!');
console.log('  Children:', Object.keys(sheepskinNode.children).length);
Object.entries(sheepskinNode.children).forEach(([key, child]) => {
    const dup = child.qbItem === sheepskinNode.qbItem ? ' DUPLICATE!' : '';
    console.log(`    - ${key}: QB ${child.qbItem}${dup}`);
});
