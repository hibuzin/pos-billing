const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");
const Bill = require("../models/bill");
const Purchase = require("../models/purchase");

const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");
const { attachHierarchy } = require("../utils/hierarchy");



router.get(
    "/sales-invoices",
    verifyToken,
    authorize("super_admin", "admin"),
    async (req, res) => {
        try {
            const hierarchy = attachHierarchy(req.user);
            const { fromDate, toDate } = req.query;

            const filter = {
                superAdminId: hierarchy.superAdminId
            };

            if (fromDate || toDate) {
                filter.createdAt = {};
                if (fromDate) filter.createdAt.$gte = new Date(fromDate);
                if (toDate) filter.createdAt.$lte = new Date(toDate);
            }

            const bills = await Bill.find(filter)
                .populate("customerId", "name phone gstin")
                .sort({ createdAt: -1 });

            res.json({
                success: true,
                count: bills.length,
                data: bills
            });

        } catch (err) {
            res.status(500).json({
                success: false,
                message: "Server error",
                error: err.message
            });
        }
    }
);



router.get(
    "/purchase-invoices",
    verifyToken,
    authorize("super_admin", "admin"),
    async (req, res) => {
        try {
            const hierarchy = attachHierarchy(req.user);
            const { fromDate, toDate } = req.query;

            const filter = {
                superAdminId: hierarchy.superAdminId
            };

            if (fromDate || toDate) {
                filter.createdAt = {};
                if (fromDate) filter.createdAt.$gte = new Date(fromDate);
                if (toDate) filter.createdAt.$lte = new Date(toDate);
            }

            const purchases = await Purchase.find(filter)
                .populate("supplierId", "name phone gstin")
                .sort({ createdAt: -1 });

            res.json({
                success: true,
                count: purchases.length,
                data: purchases
            });

        } catch (err) {
            res.status(500).json({
                success: false,
                message: "Server error",
                error: err.message
            });
        }
    }
);

module.exports = router;