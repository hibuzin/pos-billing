const mongoose = require("mongoose");
const Product = require("../models/product");
const PriceLevel = require("../models/price_level");
const { attachHierarchy } = require("../utils/hierarchy");

exports.configurePriceLevel = async (req, res) => {
    try {
        const {
            productId,
            pricingType,
            manualPrice,
            autoPricing,
            slabs
        } = req.body;

        if (!productId || !pricingType) {
            return res.status(400).json({
                success: false,
                message: "Product id and pricing type are required"
            });
        }

        if (!["manual", "auto", "slab"].includes(pricingType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid pricing type"
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

        const data = {
            productId,
            pricingType,
            manualPrice: 0,
            autoPricing: {
                baseOn: "costPrice",
                profitPercent: 0
            },
            slabs: [],
            ...hierarchy,
            createdBy: req.user.userId
        };

        if (pricingType === "manual") {
            if (!manualPrice || Number(manualPrice) <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Manual price is required"
                });
            }

            data.manualPrice = Number(manualPrice);
        }

        if (pricingType === "auto") {
            if (
                !autoPricing ||
                !["costPrice", "mrp"].includes(autoPricing.baseOn)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Valid auto pricing baseOn is required"
                });
            }

            data.autoPricing = {
                baseOn: autoPricing.baseOn,
                profitPercent: Number(autoPricing.profitPercent || 0)
            };
        }

        if (pricingType === "slab") {
            if (!Array.isArray(slabs) || slabs.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Slabs are required"
                });
            }

            data.slabs = slabs.map((s) => ({
                minQty: Number(s.minQty),
                maxQty: s.maxQty ? Number(s.maxQty) : null,
                price: Number(s.price)
            }));
        }

        const priceLevel = await PriceLevel.findOneAndUpdate(
            {
                productId,
                superAdminId: hierarchy.superAdminId
            },
            data,
            {
                new: true,
                upsert: true,
                runValidators: true
            }
        );

        return res.status(200).json({
            success: true,
            message: "Price level configured successfully",
            data: priceLevel
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

exports.getAllPriceLevels = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const priceLevels = await PriceLevel.find({
            superAdminId: hierarchy.superAdminId
        })
            .populate("productId", "name brand mrps")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: priceLevels.length,
            data: priceLevels
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

exports.getProductPriceLevel = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const priceLevel = await PriceLevel.findOne({
            productId: req.params.productId,
            superAdminId: hierarchy.superAdminId,
            isActive: true
        }).populate("productId", "name brand mrps");

        if (!priceLevel) {
            return res.status(404).json({
                success: false,
                message: "Price level not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: priceLevel
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

exports.updatePriceLevel = async (req, res) => {
    try {
        const { id } = req.params;
        const { levelName, price, isActive } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid price level id"
            });
        }

        const hierarchy = attachHierarchy(req.user);

        const updateData = {};

        if (levelName) updateData.levelName = String(levelName).trim().toLowerCase();
        if (price !== undefined) updateData.price = Number(price);
        if (isActive !== undefined) updateData.isActive = Boolean(isActive);

        const priceLevel = await PriceLevel.findOneAndUpdate(
            {
                _id: id,
                superAdminId: hierarchy.superAdminId
            },
            updateData,
            { new: true }
        );

        if (!priceLevel) {
            return res.status(404).json({
                success: false,
                message: "Price level not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Price level updated successfully",
            data: priceLevel
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

exports.deletePriceLevel = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid price level id"
            });
        }

        const hierarchy = attachHierarchy(req.user);

        const priceLevel = await PriceLevel.findOneAndDelete({
            _id: id,
            superAdminId: hierarchy.superAdminId
        });

        if (!priceLevel) {
            return res.status(404).json({
                success: false,
                message: "Price level not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Price level deleted successfully"
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

