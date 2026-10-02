const express = require("express");
const router = express.Router();

const StockLedger = require("../models/stock_ledger");
const Product = require("../models/product");

const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");
const { attachHierarchy } = require("../utils/hierarchy");



router.get(
    "/",
    verifyToken,
    authorize("super_admin", "admin"),
    async (req, res) => {
        try {
            const hierarchy = attachHierarchy(req.user);

            const {
                productId,
                type,
                direction,
                fromDate,
                toDate,
                page = 1,
                limit = 20
            } = req.query;

            const filter = {
                superAdminId: hierarchy.superAdminId
            };

            if (productId) filter.productId = productId;
            if (type) filter.type = type;
            if (direction) filter.direction = direction;

            if (fromDate || toDate) {
                filter.createdAt = {};

                if (fromDate) filter.createdAt.$gte = new Date(fromDate);
                if (toDate) filter.createdAt.$lte = new Date(toDate);
            }

            const skip = (Number(page) - 1) * Number(limit);

            const ledgers = await StockLedger.find(filter)
                .populate("productId", "name barcode unitType brand flavor")
                .populate("userId", "name email role")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit));

            const total = await StockLedger.countDocuments(filter);

            res.json({
                success: true,
                count: ledgers.length,
                total,
                page: Number(page),
                totalPages: Math.ceil(total / Number(limit)),
                data: ledgers
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
    "/product/:productId",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    async (req, res) => {
        try {
            const hierarchy = attachHierarchy(req.user);

            const product = await Product.findOne({
                _id: req.params.productId,
                superAdminId: hierarchy.superAdminId
            });

            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found"
                });
            }

            const ledgers = await StockLedger.find({
                productId: req.params.productId,
                superAdminId: hierarchy.superAdminId
            })
                .populate("userId", "name email role")
                .sort({ createdAt: -1 });

            res.json({
                success: true,
                product: {
                    id: product._id,
                    name: product.name,
                    currentStock: product.stock
                },
                count: ledgers.length,
                data: ledgers
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



router.post(
    "/adjustment",
    verifyToken,
    authorize("super_admin", "admin"),
    async (req, res) => {
        try {
            const { productId, qty, direction, note } = req.body;

            if (!productId || !qty || !direction) {
                return res.status(400).json({
                    success: false,
                    message: "productId, qty and direction are required"
                });
            }

            if (!["IN", "OUT"].includes(direction)) {
                return res.status(400).json({
                    success: false,
                    message: "Direction must be IN or OUT"
                });
            }

            const hierarchy = attachHierarchy(req.user);

            const product = await Product.findOne({
                _id: productId,
                superAdminId: hierarchy.superAdminId
            });

            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found"
                });
            }

            const quantity = Number(qty);

            if (isNaN(quantity) || quantity <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid quantity"
                });
            }

            const beforeStock = product.stock || 0;

            let afterStock;

            if (direction === "IN") {
                afterStock = beforeStock + quantity;
            } else {
                if (beforeStock < quantity) {
                    return res.status(400).json({
                        success: false,
                        message: "Insufficient stock"
                    });
                }

                afterStock = beforeStock - quantity;
            }

            product.stock = afterStock;
            await product.save();

            const ledger = await StockLedger.create({
                productId: product._id,
                type: "ADJUSTMENT",
                direction,
                qty: quantity,
                beforeStock,
                afterStock,
                note: note || "Manual stock adjustment",
                userId: req.user.id,
                role: req.user.role,
                superAdminId: hierarchy.superAdminId,
                adminId: hierarchy.adminId || null
            });

            res.status(201).json({
                success: true,
                message: "Stock adjusted successfully",
                data: ledger
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