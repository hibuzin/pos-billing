const Barcode = require("../models/barcode");
const Product = require("../models/product");
const PriceLevel = require("../models/price_level");
const { attachHierarchy } = require("../utils/hierarchy");
const { successResponse, errorResponse } = require("../utils/response");



exports.scanProductForPurchase = async (req, res) => {
    try {
        const code = String(req.params.code || "").trim();

        if (!code) {
            return res.status(400).json({
                success: false,
                message: "Barcode is required"
            });
        }

        const hierarchy = attachHierarchy(req.user);

        const barcode = await Barcode.findOne({
            code,
            superAdminId: hierarchy.superAdminId
        }).populate("productId");

        if (!barcode) {
            return res.status(404).json({
                success: false,
                message: "Barcode not found. Please create product first"
            });
        }

        const product = barcode.productId;

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        return res.json({
            success: true,
            message: "Product scanned for purchase",
            data: {
                productId: product._id,
                productName: product.name,
                brand: product.brand || "",

                barcode: barcode.code,

                hsnCode: product.hsnCode || "",
                gstRate: barcode.gstRate || product.gstRate || 0,


                kg: barcode.kg || "",

                stock: product.stock || 0,
                unit: barcode.unit || product.unit || "pcs",
                unitValue: barcode.unitValue || product.unitValue || 1,


                mrp: barcode.mrp || product.mrp || 0,
                costPrice: barcode.costPrice || product.costPrice || 0,
                sellingPrice: barcode.sellingPrice || product.sellingPrice || 0,


            }
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};


exports.scanProduct = async (req, res) => {
    try {
        const code = String(req.params.code || "").trim();

        if (!code) {
            return res.status(400).json({
                success: false,
                message: "Barcode is required"
            });
        }

        const hierarchy = attachHierarchy(req.user);

        const barcode = await Barcode.findOne({
            code,
            superAdminId: hierarchy.superAdminId,
            availableQty: { $gt: 0 }
        }).populate("productId");

        if (!barcode) {
            return res.status(404).json({
                success: false,
                message: "Barcode not found or stock not available"
            });
        }

        const product = barcode.productId;

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        const priceLevel = await PriceLevel.findOne({
            productId: product._id,
            superAdminId: hierarchy.superAdminId,
            isActive: true
        });

        return res.json({
            success: true,
            message: "Product scanned successfully",
            data: {
                barcode: barcode.code,
                barcodeId: barcode._id,

                productId: product._id,
                productName: product.name,
                brand: product.brand || "",

                qty: 1,
                availableQty: barcode.availableQty || 0,

                hsnCode: product.hsnCode || "",
                gstRate: barcode.gstRate || product.gstRate || 0,

                flavor: barcode.flavor || "",
                litters: barcode.litters || "",
                kg: barcode.kg || "",

                mrp: barcode.mrp || 0,
                sellingPrice: barcode.sellingPrice || 0,
                costPrice: barcode.costPrice || 0,

                priceLevel: priceLevel || null,
                isSold: barcode.isSold || false
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};