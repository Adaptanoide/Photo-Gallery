const mongoose = require('mongoose');

const cdeBlockedPhotoSchema = new mongoose.Schema({
    photoNumber: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    idhCode: String,
    cdeStatus: {
        type: String,
        enum: ['RESERVED', 'STANDBY'],
        required: true
    },
    firstDetected: {
        type: Date,
        default: Date.now
    },
    lastChecked: {
        type: Date,
        default: Date.now
    },
    checkCount: {
        type: Number,
        default: 0
    }
});

module.exports = mongoose.model('CDEBlockedPhoto', cdeBlockedPhotoSchema);