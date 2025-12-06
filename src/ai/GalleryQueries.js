// src/ai/GalleryQueries.js - Queries MongoDB para Gallery
// Integração da Gallery com o Sunshine Intelligence AI
// VERSÃO 2.0 - Com AccessCode e Cart

const UnifiedProductComplete = require('../models/UnifiedProductComplete');
const PhotoCategory = require('../models/PhotoCategory');
const Selection = require('../models/Selection');
const AccessCode = require('../models/AccessCode');
const Cart = require('../models/Cart');

class GalleryQueries {
    constructor() {
        this.isInitialized = false;
        this.queryStats = {};
    }

    /**
     * Inicializar conexão (MongoDB já está conectado via mongoose)
     */
    async initialize() {
        try {
            await UnifiedProductComplete.countDocuments({}).limit(1);
            this.isInitialized = true;
            console.log('✅ GalleryQueries initialized (v2.0)');
            return true;
        } catch (error) {
            console.error('❌ GalleryQueries initialization failed:', error.message);
            this.isInitialized = false;
            return false;
        }
    }

    /**
     * Executar query com logging e métricas
     */
    async executeQuery(queryName, queryPromise) {
        const startTime = Date.now();

        try {
            const result = await queryPromise;
            const elapsed = Date.now() - startTime;

            this.updateQueryStats(queryName, elapsed, true);

            if (elapsed > 2000) {
                console.warn(`⚠️ Slow Gallery query "${queryName}": ${elapsed}ms`);
            }

            return result;

        } catch (error) {
            const elapsed = Date.now() - startTime;
            this.updateQueryStats(queryName, elapsed, false);
            console.error(`❌ Gallery query "${queryName}" failed:`, error.message);
            throw error;
        }
    }

    updateQueryStats(queryName, responseTime, success) {
        if (!this.queryStats[queryName]) {
            this.queryStats[queryName] = {
                calls: 0,
                successes: 0,
                failures: 0,
                totalTime: 0,
                avgTime: 0
            };
        }

        const stats = this.queryStats[queryName];
        stats.calls++;
        stats.totalTime += responseTime;
        stats.avgTime = Math.round(stats.totalTime / stats.calls);

        if (success) {
            stats.successes++;
        } else {
            stats.failures++;
        }
    }

    // =============================================
    // PHOTOS QUERIES
    // =============================================

    async getGallerySummary() {
        const query = Promise.all([
            UnifiedProductComplete.countDocuments({
                status: 'available',
                transitStatus: { $ne: 'coming_soon' },
                cdeTable: { $ne: 'tbetiqueta' },
                isActive: true
            }),
            UnifiedProductComplete.countDocuments({
                status: { $in: ['reserved', 'reserved_pending'] },
                isActive: true
            }),
            UnifiedProductComplete.countDocuments({
                transitStatus: 'coming_soon',
                cdeTable: 'tbetiqueta',
                isActive: true
            }),
            UnifiedProductComplete.countDocuments({
                status: 'sold',
                soldAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            }),
            PhotoCategory.countDocuments({ isActive: true })
        ]);

        const [available, reserved, comingSoon, soldLast30Days, totalCategories] =
            await this.executeQuery('getGallerySummary', query);

        return {
            available,
            reserved,
            comingSoon,
            soldLast30Days,
            totalCategories,
            totalInGallery: available + reserved + comingSoon
        };
    }

    async getPhotosByCategory(limit = 15) {
        const query = UnifiedProductComplete.aggregate([
            {
                $match: {
                    status: 'available',
                    transitStatus: { $ne: 'coming_soon' },
                    cdeTable: { $ne: 'tbetiqueta' },
                    isActive: true
                }
            },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: limit }
        ]);

        return this.executeQuery('getPhotosByCategory', query);
    }

    async getReservedPhotos(clientCode = null) {
        const matchCondition = {
            status: { $in: ['reserved', 'reserved_pending'] },
            isActive: true
        };

        if (clientCode) {
            matchCondition['reservedBy.clientCode'] = clientCode;
        }

        const query = UnifiedProductComplete.aggregate([
            { $match: matchCondition },
            {
                $group: {
                    _id: '$reservedBy.clientCode',
                    count: { $sum: 1 },
                    categories: { $addToSet: '$category' }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 20 }
        ]);

        return this.executeQuery('getReservedPhotos', query);
    }

    async getComingSoonPhotos() {
        const query = UnifiedProductComplete.aggregate([
            {
                $match: {
                    transitStatus: 'coming_soon',
                    cdeTable: 'tbetiqueta',
                    isActive: true
                }
            },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    cdeStatuses: { $addToSet: '$cdeStatus' }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 15 }
        ]);

        return this.executeQuery('getComingSoonPhotos', query);
    }

    async getPhotosExpiringSoon(hours = 24) {
        const now = new Date();
        const futureDate = new Date(now.getTime() + hours * 60 * 60 * 1000);

        const query = UnifiedProductComplete.find({
            'reservedBy.expiresAt': {
                $gte: now,
                $lte: futureDate
            },
            status: { $in: ['reserved', 'reserved_pending'] }
        })
            .select('fileName category reservedBy.clientCode reservedBy.expiresAt')
            .sort({ 'reservedBy.expiresAt': 1 })
            .limit(20)
            .lean();

        return this.executeQuery('getPhotosExpiringSoon', query);
    }

    async getRecentlyAddedPhotos(days = 7) {
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const query = UnifiedProductComplete.aggregate([
            {
                $match: {
                    createdAt: { $gte: cutoffDate },
                    isActive: true
                }
            },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    latestDate: { $max: '$createdAt' }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        return this.executeQuery('getRecentlyAddedPhotos', query);
    }

    async getPhotosByCDEStatus() {
        const query = UnifiedProductComplete.aggregate([
            { $match: { isActive: true } },
            {
                $group: {
                    _id: '$cdeStatus',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        return this.executeQuery('getPhotosByCDEStatus', query);
    }

    // =============================================
    // CATEGORY & PRICING QUERIES
    // =============================================

    async getCategoriesWithPricing() {
        const query = PhotoCategory.find({
            isActive: true,
            photoCount: { $gt: 0 }
        })
            .select('displayName photoCount basePrice qbItem')
            .sort({ photoCount: -1 })
            .limit(20)
            .lean();

        return this.executeQuery('getCategoriesWithPricing', query);
    }

    async getPricingAnalysis() {
        const query = PhotoCategory.aggregate([
            {
                $match: {
                    isActive: true,
                    basePrice: { $gt: 0 }
                }
            },
            {
                $group: {
                    _id: null,
                    avgPrice: { $avg: '$basePrice' },
                    minPrice: { $min: '$basePrice' },
                    maxPrice: { $max: '$basePrice' },
                    totalCategories: { $sum: 1 },
                    totalPhotos: { $sum: '$photoCount' }
                }
            }
        ]);

        return this.executeQuery('getPricingAnalysis', query);
    }

    // =============================================
    // SELECTION QUERIES
    // =============================================

    async getActiveSelections() {
        const query = Selection.aggregate([
            {
                $match: {
                    status: { $in: ['pending', 'confirmed', 'processing'] }
                }
            },
            {
                $project: {
                    selectionId: 1,
                    clientCode: 1,
                    clientName: 1,
                    selectionType: 1,
                    totalItems: 1,
                    totalValue: 1,
                    status: 1,
                    createdAt: 1
                }
            },
            { $sort: { createdAt: -1 } },
            { $limit: 20 }
        ]);

        return this.executeQuery('getActiveSelections', query);
    }

    async getSelectionStats() {
        const query = Selection.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalItems: { $sum: '$totalItems' },
                    totalValue: { $sum: '$totalValue' }
                }
            }
        ]);

        return this.executeQuery('getSelectionStats', query);
    }

    async getSelectionsByClient(clientCode) {
        const query = Selection.find({
            clientCode: clientCode
        })
            .select('selectionId selectionType status totalItems totalValue createdAt')
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        return this.executeQuery('getSelectionsByClient', query);
    }

    // =============================================
    // CLIENT QUERIES (AccessCode) - NOVO!
    // =============================================

    async getClientsSummary() {
        const query = Promise.all([
            AccessCode.countDocuments({ isActive: true }),
            AccessCode.countDocuments({ isActive: false }),
            AccessCode.countDocuments({ accessType: 'normal', isActive: true }),
            AccessCode.countDocuments({ accessType: 'special', isActive: true }),
            AccessCode.countDocuments({ 'metadata.isVipClient': true, isActive: true })
        ]);

        const [active, inactive, normalAccess, specialAccess, vipClients] =
            await this.executeQuery('getClientsSummary', query);

        return {
            totalClients: active + inactive,
            activeClients: active,
            inactiveClients: inactive,
            normalAccess,
            specialAccess,
            vipClients
        };
    }

    async getTopClientsByUsage(limit = 10) {
        const query = AccessCode.find({ isActive: true })
            .select('code clientName companyName usageCount lastUsed salesRep metadata.isVipClient')
            .sort({ usageCount: -1 })
            .limit(limit)
            .lean();

        return this.executeQuery('getTopClientsByUsage', query);
    }

    async getRecentlyActiveClients(days = 7) {
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const query = AccessCode.find({
            isActive: true,
            lastUsed: { $gte: cutoffDate }
        })
            .select('code clientName companyName lastUsed usageCount salesRep')
            .sort({ lastUsed: -1 })
            .limit(20)
            .lean();

        return this.executeQuery('getRecentlyActiveClients', query);
    }

    async getClientsBySalesRep() {
        const query = AccessCode.aggregate([
            { $match: { isActive: true } },
            {
                $group: {
                    _id: '$salesRep',
                    clientCount: { $sum: 1 },
                    totalUsage: { $sum: '$usageCount' },
                    vipCount: {
                        $sum: { $cond: ['$metadata.isVipClient', 1, 0] }
                    }
                }
            },
            { $sort: { clientCount: -1 } }
        ]);

        return this.executeQuery('getClientsBySalesRep', query);
    }

    async getVipClients() {
        const query = AccessCode.find({
            'metadata.isVipClient': true,
            isActive: true
        })
            .select('code clientName companyName clientEmail usageCount lastUsed salesRep')
            .sort({ usageCount: -1 })
            .lean();

        return this.executeQuery('getVipClients', query);
    }

    async getClientByCode(clientCode) {
        const query = AccessCode.findOne({ code: clientCode })
            .select('code clientName clientEmail companyName salesRep usageCount lastUsed accessType metadata showPrices')
            .lean();

        return this.executeQuery('getClientByCode', query);
    }

    async getInactiveClients(days = 30) {
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const query = AccessCode.find({
            isActive: true,
            $or: [
                { lastUsed: { $lt: cutoffDate } },
                { lastUsed: null }
            ]
        })
            .select('code clientName companyName lastUsed createdAt salesRep')
            .sort({ lastUsed: 1 })
            .limit(20)
            .lean();

        return this.executeQuery('getInactiveClients', query);
    }

    async getClientsByRegion() {
        const query = AccessCode.aggregate([
            { $match: { isActive: true, state: { $exists: true, $ne: null } } },
            {
                $group: {
                    _id: '$state',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 15 }
        ]);

        return this.executeQuery('getClientsByRegion', query);
    }

    async getMarketingStats() {
        const query = Promise.all([
            AccessCode.countDocuments({ marketingUnsubscribed: false, isActive: true }),
            AccessCode.countDocuments({ marketingUnsubscribed: true }),
            AccessCode.countDocuments({ marketingEmailOpened: true }),
            AccessCode.countDocuments({ marketingEmailClicked: true })
        ]);

        const [subscribed, unsubscribed, opened, clicked] =
            await this.executeQuery('getMarketingStats', query);

        return {
            subscribedClients: subscribed,
            unsubscribedClients: unsubscribed,
            emailsOpened: opened,
            emailsClicked: clicked,
            openRate: subscribed > 0 ? Math.round((opened / subscribed) * 100) : 0,
            clickRate: opened > 0 ? Math.round((clicked / opened) * 100) : 0
        };
    }

    // =============================================
    // CART QUERIES - NOVO!
    // =============================================

    async getActiveCartsSummary() {
        const query = Promise.all([
            Cart.countDocuments({ isActive: true }),
            Cart.aggregate([
                { $match: { isActive: true } },
                { $group: { _id: null, totalItems: { $sum: '$totalItems' } } }
            ]),
            Cart.find({ isActive: true })
                .select('clientCode clientName totalItems lastActivity')
                .sort({ lastActivity: -1 })
                .limit(10)
                .lean()
        ]);

        const [totalCarts, itemsAgg, recentCarts] =
            await this.executeQuery('getActiveCartsSummary', query);

        return {
            activeCarts: totalCarts,
            totalItemsInCarts: itemsAgg[0]?.totalItems || 0,
            recentCarts: recentCarts
        };
    }

    async getCartsWithMostItems(limit = 10) {
        const query = Cart.find({ isActive: true, totalItems: { $gt: 0 } })
            .select('clientCode clientName totalItems lastActivity')
            .sort({ totalItems: -1 })
            .limit(limit)
            .lean();

        return this.executeQuery('getCartsWithMostItems', query);
    }

    async getCartsExpiringSoon(hours = 6) {
        const now = new Date();
        const futureDate = new Date(now.getTime() + hours * 60 * 60 * 1000);

        const query = Cart.find({
            isActive: true,
            'items.expiresAt': {
                $gte: now,
                $lte: futureDate
            }
        })
            .select('clientCode clientName totalItems items.expiresAt')
            .lean();

        return this.executeQuery('getCartsExpiringSoon', query);
    }

    async getCartByClient(clientCode) {
        const query = Cart.findOne({
            clientCode: clientCode,
            isActive: true
        })
            .select('clientName totalItems items lastActivity')
            .lean();

        return this.executeQuery('getCartByClient', query);
    }

    async getComingSoonItemsInCarts() {
        const query = Cart.aggregate([
            { $match: { isActive: true } },
            { $unwind: '$items' },
            { $match: { 'items.isComingSoon': true } },
            {
                $group: {
                    _id: '$clientCode',
                    clientName: { $first: '$clientName' },
                    comingSoonItems: { $sum: 1 }
                }
            },
            { $sort: { comingSoonItems: -1 } }
        ]);

        return this.executeQuery('getComingSoonItemsInCarts', query);
    }

    async getGhostItemsInCarts() {
        const query = Cart.aggregate([
            { $match: { isActive: true } },
            { $unwind: '$items' },
            { $match: { 'items.ghostStatus': 'ghost' } },
            {
                $group: {
                    _id: '$clientCode',
                    clientName: { $first: '$clientName' },
                    ghostItems: { $sum: 1 },
                    reasons: { $addToSet: '$items.ghostReason' }
                }
            },
            { $sort: { ghostItems: -1 } }
        ]);

        return this.executeQuery('getGhostItemsInCarts', query);
    }

    // =============================================
    // COMBINED / DASHBOARD QUERIES
    // =============================================

    async getQuickStats() {
        const [summary, topCategories, activeSelectionsCount, clientsSummary, cartsSummary] =
            await Promise.all([
                this.getGallerySummary(),
                this.getPhotosByCategory(5),
                Selection.countDocuments({ status: { $in: ['pending', 'confirmed'] } }),
                this.getClientsSummary(),
                this.getActiveCartsSummary()
            ]);

        return {
            photos: summary,
            topCategories: topCategories.map(c => ({
                category: c._id,
                count: c.count
            })),
            activeSelections: activeSelectionsCount,
            clients: clientsSummary,
            carts: cartsSummary
        };
    }

    async getFullDashboardData() {
        const [
            gallerySummary,
            photosByCategory,
            clientsSummary,
            cartsSummary,
            activeSelections,
            marketingStats,
            topClients
        ] = await Promise.all([
            this.getGallerySummary(),
            this.getPhotosByCategory(10),
            this.getClientsSummary(),
            this.getActiveCartsSummary(),
            this.getActiveSelections(),
            this.getMarketingStats(),
            this.getTopClientsByUsage(5)
        ]);

        return {
            gallery: gallerySummary,
            categories: photosByCategory,
            clients: clientsSummary,
            carts: cartsSummary,
            selections: activeSelections,
            marketing: marketingStats,
            topClients: topClients
        };
    }

    // =============================================
    // UTILITY METHODS
    // =============================================

    async testConnection() {
        try {
            await UnifiedProductComplete.countDocuments({}).limit(1);
            return true;
        } catch (error) {
            console.error('❌ Gallery connection test failed:', error.message);
            return false;
        }
    }

    getQueryStats() {
        return Object.entries(this.queryStats).map(([name, data]) => ({
            query: name,
            calls: data.calls,
            avgTime: `${data.avgTime}ms`,
            successRate: `${Math.round((data.successes / data.calls) * 100)}%`
        }));
    }
}

module.exports = GalleryQueries;