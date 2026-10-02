const ProductPriceHistory = require("../models/product_price_history");
const { attachHierarchy } = require("../utils/hierarchy");
const product = require("../models/product");
const Purchase = require("../models/purchase");
const mongoose = require("mongoose");


exports.getAllPurchaseProductHistory = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const history = await Purchase.aggregate([
            {
                $match: {
                    superAdminId: new mongoose.Types.ObjectId(hierarchy.superAdminId)
                }
            },
            { $unwind: "$items" },
            {
                $sort: {
                    createdAt: -1
                }
            },
            {
                $project: {
                    _id: 0,
                    purchaseId: "$_id",
                    invoiceNo: 1,
                    invoiceDate: 1,
                    supplierName: 1,

                    productId: "$items.productId",
                    productName: "$items.productName",
                    barcode: "$items.barcode",

                    qty: "$items.qty",
                    mrp: "$items.mrp",
                    costPrice: "$items.costPrice",
                    sellingPrice: "$items.sellingPrice",

                    gstpercentage: "$items.gstpercentage",
                    gst: "$items.gst",
                    totalCostWithGST: "$items.totalCostWithGST",

                    createdAt: 1
                }
            }
        ]);

        const formattedHistory = history.map((item) => ({
            ...item,
            purchaseDate: item.invoiceDate
                ? new Date(item.invoiceDate).toLocaleDateString("en-GB").replace(/\//g, "-")
                : ""
        }));

        return res.status(200).json({
            success: true,
            count: formattedHistory.length,
            data: formattedHistory
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};


exports.getPurchasePriceHistoryByProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        const hierarchy = attachHierarchy(req.user);

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product id"
            });
        }

        const history = await Purchase.aggregate([
            {
                $match: {
                    superAdminId: new mongoose.Types.ObjectId(hierarchy.superAdminId)
                }
            },
            { $unwind: "$items" },
            {
                $match: {
                    "items.productId": new mongoose.Types.ObjectId(productId)
                }
            },
            {
                $sort: {
                    invoiceDate: -1,
                    createdAt: -1
                }
            },
            {
                $project: {
                    _id: 0,
                    purchaseId: "$_id",
                    invoiceNo: 1,
                    invoiceDate: 1,
                    supplierName: 1,

                    productId: "$items.productId",
                    productName: "$items.productName",
                    barcode: "$items.barcode",

                    qty: "$items.qty",
                    mrp: "$items.mrp",
                    costPrice: "$items.costPrice",
                    sellingPrice: "$items.sellingPrice",

                    gstpercentage: "$items.gstpercentage",
                    gst: "$items.gst",
                    totalCostWithGST: "$items.totalCostWithGST",

                    createdAt: 1
                }
            }
        ]);

         const formattedHistory = history.map((item) => ({
            ...item,
            purchaseDate: item.invoiceDate
                ? new Date(item.invoiceDate).toLocaleDateString("en-GB").replace(/\//g, "-")
                : ""
        }));

        return res.status(200).json({
            success: true,
            count: formattedHistory.length,
            data: formattedHistory
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

