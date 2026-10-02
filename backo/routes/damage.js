const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");
const Damage = require("../models/damage");
const Product = require("../models/product");

const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");
const { attachHierarchy } = require("../utils/hierarchy");


router.post(
    "/damage",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    async (req, res) => {
        try {
            const { productId, qty, reason } = req.body;

            if (!mongoose.Types.ObjectId.isValid(productId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid product id",
                });
            }

            if (!qty || qty <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid quantity",
                });
            }

            const hierarchy = attachHierarchy(req.user);

            const product = await Product.findOne({
                _id: productId,
                superAdminId: hierarchy.superAdminId,
            });

            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found",
                });
            }

            
            if (product.stock < qty) {
                return res.status(400).json({
                    success: false,
                    message: "Insufficient stock",
                });
            }


            const updatedProduct = await Product.findOneAndUpdate(
                {
                    _id: productId,
                    superAdminId: hierarchy.superAdminId,
                    stock: { $gte: qty }
                },
                {
                    $inc: {
                        stock: -qty,
                        damagedStock: qty
                    }
                },
                { new: true }
            );

            if (!updatedProduct) {
                return res.status(400).json({
                    success: false,
                    message: "Insufficient stock or product not found",
                });
            }

            const damage = await Damage.create({
                productId,
                qty,
                reason,
                stockBefore: updatedProduct.stock + qty,
                stockAfter: updatedProduct.stock,
                ...hierarchy,
            });

            res.status(201).json({
                success: true,
                message: "Damage recorded successfully",
                data: damage,
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                message: "Server error",
                error: err.message,
            });
        }
    }
);

router.get(
    "/damage",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    async (req, res) => {
        try {
            const hierarchy = attachHierarchy(req.user);

            const damages = await Damage.find({
                superAdminId: hierarchy.superAdminId,
            })
                .populate("productId", "name sellingPrice stock damagedStock")
                .sort({ createdAt: -1 });

            res.json({
                success: true,
                count: damages.length,
                data: damages,
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                message: err.message,
            });
        }
    }
);


router.get(
    "/damage/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    async (req, res) => {
        try {
            const { id } = req.params;
            const { superAdminId } = req.user;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid id",
                });
            }

            const damage = await Damage.findOne({
                _id: id,
                superAdminId,
            }).populate("productId");

            if (!damage) {
                return res.status(404).json({
                    success: false,
                    message: "Damage not found",
                });
            }

            res.json({
                success: true,
                data: damage,
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                message: err.message,
            });
        }
    }
);


router.delete(
    "/damage/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    async (req, res) => {
        try {
            const { id } = req.params;
            const { superAdminId } = req.user;

            const damage = await Damage.findOne({
                _id: id,
                superAdminId,
            });

            if (!damage) {
                return res.status(404).json({
                    success: false,
                    message: "Damage not found",
                });
            }

           
            await Product.updateOne(
                { _id: damage.productId },
                { $inc: { stock: damage.qty } }
            );

            await damage.deleteOne();

            res.json({
                success: true,
                message: "Damage deleted & stock restored",
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                message: err.message,
            });
        }
    }
);


module.exports = router;