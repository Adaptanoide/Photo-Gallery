// src/routes/stock.js
// =====================================================
// STOCK CONTROL - Unified inventory view
// =====================================================
// Combines unique photos (UnifiedProductComplete) +
// sample stock (CatalogProduct) + transit items (tbetiqueta)

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const { authenticateToken } = require('./auth');

// Use the same auth middleware as inventory-monitor
router.use(authenticateToken);

// Lazy load models to avoid circular dependencies
let UnifiedProductComplete = null;
let CatalogProduct = null;
let PhotoCategory = null;

function getModels() {
    if (!UnifiedProductComplete) {
        UnifiedProductComplete = require('../models/UnifiedProductComplete');
        CatalogProduct = require('../models/CatalogProduct');
        PhotoCategory = require('../models/PhotoCategory');
    }
    return { UnifiedProductComplete, CatalogProduct, PhotoCategory };
}

// ============================================
// GET /api/stock/overview
// ============================================
// Returns unified stock view with all inventory types
// Query params:
//   - filter: 'all' | 'unique' | 'sample' | 'transit' | 'issues'
//   - page: pagination (default 1)
//   - limit: items per page (default 50)
router.get('/overview', async (req, res) => {
    try {
        const { filter = 'all', page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        console.log(`[STOCK] Overview request - filter: ${filter}, page: ${page}`);

        const { UnifiedProductComplete, CatalogProduct } = getModels();

        // ============================================
        // 1. FETCH ALL DATA SOURCES
        // ============================================

        // A. Unique Photos (from MongoDB)
        const uniquePhotos = await UnifiedProductComplete.find({ isActive: true })
            .select('photoNumber fileName qbItem category status cdeStatus idhCode r2Path')
            .lean();

        console.log(`[STOCK] Found ${uniquePhotos.length} unique photos`);

        // B. Sample Stock (from MongoDB)
        const sampleStock = await CatalogProduct.find({ isActive: true })
            .select('qbItem name category currentStock physicalStock availableStock displayCategory')
            .lean();

        console.log(`[STOCK] Found ${sampleStock.length} sample stock items`);

        // C. Transit Items (from CDE tbetiqueta)
        const transitItems = await fetchTransitItems();

        console.log(`[STOCK] Found ${transitItems.length} transit items`);

        // ============================================
        // 2. DETECT ISSUES IN UNIQUE PHOTOS
        // ============================================
        const issuesData = await detectIssues(uniquePhotos);

        console.log(`[STOCK] Detected ${issuesData.issues.length} issues`);

        // ============================================
        // 3. GROUP ITEMS BY QB ITEM
        // ============================================

        // Group unique photos by QB Item
        const uniquePhotosByQB = {};
        const availablePhotosCount = uniquePhotos.filter(p => p.status === 'available').length;

        uniquePhotos.forEach(photo => {
            const qb = photo.qbItem || 'UNKNOWN';
            if (!uniquePhotosByQB[qb]) {
                uniquePhotosByQB[qb] = {
                    qbItem: qb,
                    category: photo.category || 'Unknown Category',
                    photos: [],
                    availableCount: 0,
                    totalCount: 0
                };
            }
            uniquePhotosByQB[qb].photos.push(photo);
            uniquePhotosByQB[qb].totalCount++;
            if (photo.status === 'available') {
                uniquePhotosByQB[qb].availableCount++;
            }
        });

        // Group transit items by QB Item
        const transitByQB = {};
        transitItems.forEach(item => {
            const qb = item.qbItem || 'UNKNOWN';
            if (!transitByQB[qb]) {
                transitByQB[qb] = {
                    qbItem: qb,
                    items: [],
                    count: 0
                };
            }
            transitByQB[qb].items.push(item);
            transitByQB[qb].count++;
        });

        // ============================================
        // 4. BUILD UNIFIED ITEMS LIST (GROUPED)
        // ============================================
        let allItems = [];

        // Add issues (priority #1 - always at top)
        issuesData.issues.forEach(issue => {
            allItems.push({
                type: 'Issue',
                typeIcon: '⚠️',
                qbItem: issue.qbItem || issue.photoNumber || '?',
                description: issue.title,
                category: issue.category || 'Problem Detected',
                quantity: 1,
                status: issue.severity,
                action: 'fix',
                metadata: issue,
                sortPriority: 1 // Top priority
            });
        });

        // Add unique photos (grouped by QB)
        Object.values(uniquePhotosByQB).forEach(group => {
            allItems.push({
                type: 'Unique Photo',
                typeIcon: '📷',
                qbItem: group.qbItem,
                description: group.category,
                category: `${group.availableCount} available / ${group.totalCount} total`,
                quantity: group.availableCount, // Show only available
                status: group.availableCount > 0 ? 'available' : 'no-stock',
                action: 'view',
                metadata: {
                    photos: group.photos,
                    availableCount: group.availableCount,
                    totalCount: group.totalCount
                },
                sortPriority: 2
            });
        });

        // Add sample stock (already one per QB)
        const { CATALOG_TO_MAIN_CATEGORY } = require('../config/categoryMapping');
        sampleStock.forEach(item => {
            const mainCategory = CATALOG_TO_MAIN_CATEGORY[item.displayCategory] || 'Other';

            allItems.push({
                type: 'Sample Stock',
                typeIcon: '📦',
                qbItem: item.qbItem,
                description: item.name,
                category: mainCategory,
                quantity: item.currentStock || 0,
                status: item.currentStock > 0 ? 'available' : 'no-stock',
                action: 'view',
                metadata: item,
                sortPriority: 3
            });
        });

        // Add transit items (grouped by QB)
        Object.values(transitByQB).forEach(group => {
            allItems.push({
                type: 'Transit',
                typeIcon: '🚚',
                qbItem: group.qbItem,
                description: `In Transit - ${group.count} items`,
                category: 'Coming Soon',
                quantity: group.count,
                status: 'in-transit',
                action: 'view',
                metadata: {
                    items: group.items,
                    count: group.count
                },
                sortPriority: 4
            });
        });

        // Sort: Issues first, then by sortPriority, then by quantity
        allItems.sort((a, b) => {
            if (a.sortPriority !== b.sortPriority) {
                return a.sortPriority - b.sortPriority;
            }
            return (b.quantity || 0) - (a.quantity || 0);
        });

        // ============================================
        // 5. APPLY FILTERS
        // ============================================
        let filteredItems = allItems;

        if (filter === 'unique') {
            filteredItems = allItems.filter(i => i.type === 'Unique Photo');
        } else if (filter === 'sample') {
            filteredItems = allItems.filter(i => i.type === 'Sample Stock');
        } else if (filter === 'transit') {
            filteredItems = allItems.filter(i => i.type === 'Transit');
        } else if (filter === 'issues') {
            filteredItems = allItems.filter(i => i.type === 'Issue');
        }
        // 'all' = no filter, show everything

        console.log(`[STOCK] Filtered to ${filteredItems.length} items (filter: ${filter})`);

        // ============================================
        // 5. PAGINATION
        // ============================================
        const total = filteredItems.length;
        const paginatedItems = filteredItems.slice(skip, skip + parseInt(limit));

        // ============================================
        // 6. BUILD RESPONSE
        // ============================================
        res.json({
            success: true,
            summary: {
                uniquePhotos: availablePhotosCount, // Only available photos
                sampleStock: sampleStock.length,
                transitItems: transitItems.length,
                issues: issuesData.issues.length
            },
            items: paginatedItems,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            },
            activeFilter: filter
        });

    } catch (error) {
        console.error('[STOCK] Error fetching overview:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar stock overview',
            details: error.message
        });
    }
});

// ============================================
// HELPER: Fetch Transit Items from CDE
// ============================================
async function fetchTransitItems() {
    let cdeConnection;
    try {
        cdeConnection = await mysql.createConnection({
            host: process.env.CDE_HOST,
            port: parseInt(process.env.CDE_PORT),
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        });

        const [results] = await cdeConnection.execute(`
            SELECT
                ATIPOETIQUETA as photoNumber,
                AQBITEM as qbItem,
                AESTADOP as status,
                AFECHA as date
            FROM tbetiqueta
            WHERE AESTADOP = 'PRE-TRANSITO'
            AND ATIPOETIQUETA IS NOT NULL
            ORDER BY AFECHA DESC
        `);

        await cdeConnection.end();

        return results.map(r => ({
            photoNumber: r.photoNumber,
            qbItem: r.qbItem,
            status: r.status,
            date: r.date,
            category: null // Will need QB → category mapping
        }));

    } catch (error) {
        console.error('[STOCK] Error fetching transit items:', error);
        if (cdeConnection) await cdeConnection.end();
        return [];
    }
}

// ============================================
// HELPER: Detect Issues in Unique Photos
// ============================================
async function detectIssues(uniquePhotos) {
    const issues = [];

    // For now, return basic structure
    // Will implement full issue detection in next phase
    // Reuse logic from inventory-monitor.js

    // TODO: Implement:
    // - CDE vs MongoDB discrepancies
    // - IDH collisions
    // - QB mismatches (PASE needed)
    // - Missing photos in R2
    // - Status conflicts

    return {
        issues,
        summary: {
            critical: 0,
            warnings: 0,
            pending: 0
        }
    };
}

module.exports = router;
