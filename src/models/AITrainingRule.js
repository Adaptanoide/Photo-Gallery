const mongoose = require('mongoose');

const aiTrainingRuleSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['restock', 'pricing', 'seasonal', 'client', 'general'],
        required: true
    },
    description: {
        type: String,
        required: true
    },
    created_by: {
        type: String,
        default: 'Andy'
    },
    active: {
        type: Boolean,
        default: true
    },
    applied: {
        type: Boolean,
        default: false  // Marca quando já foi implementado
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('AITrainingRule', aiTrainingRuleSchema);