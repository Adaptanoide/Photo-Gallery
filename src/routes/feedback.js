// src/routes/feedback.js
const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');

// POST /api/feedback - Submit new feedback
router.post('/', async (req, res) => {
    try {
        const { clientName, clientCode, type, message, page } = req.body;

        // Validate required fields
        if (!clientName) {
            return res.status(400).json({ success: false, message: 'Client name is required' });
        }

        // Create feedback entry
        const feedback = new Feedback({
            clientName,
            clientCode: clientCode || '',
            type: type || 'general',
            message: message || '',
            page: page || 'unknown'
        });

        await feedback.save();

        console.log(`[Feedback] New ${type} feedback from ${clientName}`);

        res.json({ success: true, message: 'Feedback submitted successfully' });
    } catch (error) {
        console.error('[Feedback] Error saving feedback:', error);
        res.status(500).json({ success: false, message: 'Error saving feedback' });
    }
});

// GET /api/feedback - Get all feedback (admin only)
router.get('/', async (req, res) => {
    try {
        const { status, type, limit = 50, skip = 0 } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (type) filter.type = type;

        const feedback = await Feedback.find(filter)
            .sort({ createdAt: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit));

        const total = await Feedback.countDocuments(filter);

        res.json({
            success: true,
            feedback,
            total,
            hasMore: skip + feedback.length < total
        });
    } catch (error) {
        console.error('[Feedback] Error fetching feedback:', error);
        res.status(500).json({ success: false, message: 'Error fetching feedback' });
    }
});

// GET /api/feedback/stats - Get feedback statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await Feedback.aggregate([
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 }
                }
            }
        ]);

        const statusStats = await Feedback.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const total = await Feedback.countDocuments();
        const newCount = await Feedback.countDocuments({ status: 'new' });

        res.json({
            success: true,
            total,
            newCount,
            byType: stats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
            byStatus: statusStats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {})
        });
    } catch (error) {
        console.error('[Feedback] Error fetching stats:', error);
        res.status(500).json({ success: false, message: 'Error fetching stats' });
    }
});

// PATCH /api/feedback/:id - Update feedback status
router.patch('/:id', async (req, res) => {
    try {
        const { status, adminNotes } = req.body;

        // First get the current feedback to check its state
        const currentFeedback = await Feedback.findById(req.params.id);
        if (!currentFeedback) {
            return res.status(404).json({ success: false, message: 'Feedback not found' });
        }

        const updateData = {};
        if (status) {
            updateData.status = status;
            if (status === 'read') updateData.readAt = new Date();
            if (status === 'resolved') {
                updateData.resolvedAt = new Date();
                // Also mark as read if not already read (direct resolve)
                if (!currentFeedback.readAt) {
                    updateData.readAt = new Date();
                }
            }
        }
        if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

        const feedback = await Feedback.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );

        if (!feedback) {
            return res.status(404).json({ success: false, message: 'Feedback not found' });
        }

        res.json({ success: true, feedback });
    } catch (error) {
        console.error('[Feedback] Error updating feedback:', error);
        res.status(500).json({ success: false, message: 'Error updating feedback' });
    }
});

// DELETE /api/feedback/:id - Delete feedback
router.delete('/:id', async (req, res) => {
    try {
        const feedback = await Feedback.findByIdAndDelete(req.params.id);

        if (!feedback) {
            return res.status(404).json({ success: false, message: 'Feedback not found' });
        }

        res.json({ success: true, message: 'Feedback deleted' });
    } catch (error) {
        console.error('[Feedback] Error deleting feedback:', error);
        res.status(500).json({ success: false, message: 'Error deleting feedback' });
    }
});

module.exports = router;
