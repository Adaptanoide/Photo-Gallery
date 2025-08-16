//src/services/index.js

const CartService = require('./CartService');
const EmailService = require('./EmailService');
const PhotoTagService = require('./PhotoTagService');
const PricingService = require('./PricingService');
const SpecialSelectionService = require('./SpecialSelectionService');
const R2Service = require('./R2Service');

module.exports = {
    CartService,
    EmailService,
    PricingService, 
    SpecialSelectionService,
    PhotoTagService,
    R2Service
};