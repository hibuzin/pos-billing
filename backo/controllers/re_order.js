const mongoose = require("mongoose");
const Product = require("../models/product");
const { attachHierarchy } = require("../utils/hierarchy");

exports.getReorder = async (req, res) => {
    try {

        const { page = 1, limit = 10, search = "" } = req.query;

        const hierarchy = attachHierarchy(req.user);

        const query = {
            superAdminId: hierarchy.superAdminId
        };


        if (search) {
            query.name = {
                $regex: search,
                $options: "i"
            };
        }


        query.$expr = {
            $lte: ["$stock", "$reorderLevel"]
        };

        const products = await Product.find(query)
            .populate("categoryId", "name")
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .sort({ stock: 1 });

        const total = await Product.countDocuments(query);

        res.json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
            data: products
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
}

exports.getReorderCount = async (req, res) => {
    try {

        const hierarchy = attachHierarchy(req.user);

        const count = await Product.countDocuments({
            superAdminId: hierarchy.superAdminId,
            $expr: {
                $lte: ["$stock", "$reorderLevel"]
            }
        });

        res.json({
            success: true,
            reorderCount: count
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
}