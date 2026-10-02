const express = require("express");
const router = express.Router();

const Product = require("../models/product");
const User = require("../models/user");
const StockRebilling = require("../models/stock_rebilling");

const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");
const { attachHierarchy } = require("../utils/hierarchy");



router.post(
    "/stock-rebilling",
    verifyToken,
    authorize("super_admin", "admin"),
    async (req, res) => {
        try {
            const { fromCounterId, toCounterId, items } = req.body;

            if (!fromCounterId || !toCounterId || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "fromCounterId, toCounterId and items are required"
                });
            }

            if (fromCounterId === toCounterId) {
                return res.status(400).json({
                    success: false,
                    message: "From counter and to counter cannot be same"
                });
            }

            const hierarchy = attachHierarchy(req.user);

            const fromCounter = await User.findOne({
                _id: fromCounterId,
                superAdminId: hierarchy.superAdminId,
                role: "cashier"
            });

            if (!fromCounter) {
                return res.status(404).json({
                    success: false,
                    message: "From counter/cashier not found"
                });
            }

            const toCounter = await User.findOne({
                _id: toCounterId,
                superAdminId: hierarchy.superAdminId,
                role: "cashier"
            });

            if (!toCounter) {
                return res.status(404).json({
                    success: false,
                    message: "To counter/cashier not found"
                });
            }

            let totalItems = 0;
            const processedItems = [];

            for (const item of items) {
                const qty = Number(item.qty);

                if (!item.productId || isNaN(qty) || qty <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: "Valid productId and qty required"
                    });
                }

                const product = await Product.findOne({
                    _id: item.productId,
                    superAdminId: hierarchy.superAdminId
                });

                if (!product) {
                    return res.status(404).json({
                        success: false,
                        message: "Product not found"
                    });
                }

                processedItems.push({
                    productId: item.productId,
                    qty
                });

                totalItems += qty;
            }

            const rebilling = await CounterStockRebilling.create({
                fromCounterId,
                toCounterId,
                items: processedItems,
                totalItems,
                status: "completed",
                ...hierarchy,
                createdBy: req.user.userId
            });

            res.status(201).json({
                success: true,
                message: "Counter stock rebilling created successfully",
                data: rebilling
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
    "/counter-stock-rebilling",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    async (req, res) => {
        try {
            const { page = 1, limit = 10 } = req.query;
            const hierarchy = attachHierarchy(req.user);

            const records = await CounterStockRebilling.find({
                superAdminId: hierarchy.superAdminId
            })
                .populate("fromCounterId", "name email role")
                .populate("toCounterId", "name email role")
                .populate("items.productId", "name sellingPrice stock")
                .skip((Number(page) - 1) * Number(limit))
                .limit(Number(limit))
                .sort({ createdAt: -1 });

            const total = await CounterStockRebilling.countDocuments({
                superAdminId: hierarchy.superAdminId
            });

            res.json({
                success: true,
                total,
                page: Number(page),
                pages: Math.ceil(total / Number(limit)),
                data: records
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
    "/counter-stock-rebilling/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    async (req, res) => {
        try {
            const { id } = req.params;
            const hierarchy = attachHierarchy(req.user);

            const record = await CounterStockRebilling.findOne({
                _id: id,
                superAdminId: hierarchy.superAdminId
            })
                .populate("fromCounterId", "name email role")
                .populate("toCounterId", "name email role")
                .populate("items.productId", "name sellingPrice stock");

            if (!record) {
                return res.status(404).json({
                    success: false,
                    message: "Counter stock rebilling not found"
                });
            }

            res.json({
                success: true,
                data: record
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
