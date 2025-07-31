//src/services/index.js

const CartService = require('./CartService');
const EmailService = require('./EmailService');
const GoogleDriveService = require('./GoogleDriveService');
const PricingService = require('./PricingService');
const SpecialSelectionService = require('./SpecialSelectionService'); // NOVO

module.exports = {
    CartService,
    EmailService,
    GoogleDriveService,
    PricingService,
    SpecialSelectionService // NOVO
};