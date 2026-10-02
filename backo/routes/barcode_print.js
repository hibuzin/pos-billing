const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");

const Barcode = require("../models/barcode");
const Product = require("../models/product");
const Purchase = require("../models/purchase");

const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");
const { attachHierarchy } = require("../utils/hierarchy");



router.get(
    "/barcode-print/product/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    async (req, res) => {
        try {

            const { id } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid product id"
                });
            }

            const hierarchy = attachHierarchy(req.user);


            const product = await Product.findOne({
                _id: id,
                superAdminId: hierarchy.superAdminId
            }).populate("categoryId", "name");

            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found"
                });
            }

            const barcodes = await Barcode.find({
                productId: product._id,
                superAdminId: hierarchy.superAdminId
            }).sort({ createdAt: -1 });

            res.json({
                success: true,
                total: barcodes.length,
                product,
                data: barcodes
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
    "/barcode-print/purchase/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    async (req, res) => {
        try {

            const { id } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid purchase id"
                });
            }

            const hierarchy = attachHierarchy(req.user);

            const purchase = await Purchase.findOne({
                _id: id,
                superAdminId: hierarchy.superAdminId
            }).populate("items.productId", "name");

            if (!purchase) {
                return res.status(404).json({
                    success: false,
                    message: "Purchase not found"
                });
            }

            const result = [];

            for (const item of purchase.items) {

                const barcodes = await Barcode.find({
                    productId: item.productId._id,
                    superAdminId: hierarchy.superAdminId
                }).sort({ createdAt: -1 });

                result.push({
                    product: item.productId,
                    qty: item.qty,
                    barcodes
                });
            }

            res.json({
                success: true,
                purchaseId: purchase._id,
                totalProducts: result.length,
                data: result
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