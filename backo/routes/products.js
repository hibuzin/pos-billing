const express = require("express");
const router = express.Router();
const Product = require("../models/product");
const Barcode = require("../models/barcode");
const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");
const { attachHierarchy } = require("../utils/hierarchy");
const Category = require("../models/category");


const generateBarcode = () => {
    return Math.floor(100000000000 + Math.random() * 900000000000).toString();
};

const generateUniqueBarcodes = async (count) => {
    const codes = new Set();

    while (codes.size < count) {
        const code = generateBarcode();

        const exists = await Barcode.exists({ code });

        if (!exists) {
            codes.add(code);
        }
    }

    return [...codes];
};

router.post(
    "/",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    async (req, res) => {
        try {
            const {
                name,
                sellingPrice,
                costPrice = 0,
                gst = 0,
                stock,
                barcodeCount,
                categoryId,
                unitType = "piece",
                unitValue = 1,
                reorderLevel = 0
            } = req.body;

            if (!name || !sellingPrice || stock === undefined || !categoryId) {
                return res.status(400).json({
                    success: false,
                    message: "Name, sellingPrice, stock, and categoryId are required"
                });
            }

            const hierarchy = attachHierarchy(req.user);
            const productName = name.trim();


            const category = await Category.findOne({
                _id: categoryId,
                superAdminId: hierarchy.superAdminId
            });

            if (!category) {
                return res.status(404).json({
                    success: false,
                    message: "Category not found"
                });
            }


            const existingProduct = await Product.findOne({
                name: productName,
                superAdminId: hierarchy.superAdminId
            });

            if (existingProduct) {
                return res.status(400).json({
                    success: false,
                    message: "Product already exists"
                });
            }

            const stockNumber = Number(stock);
            const sellingPriceNumber = Number(sellingPrice);
            const costPriceNumber = Number(costPrice);
            const gstNumber = Number(gst);
            const barcodeTotal = barcodeCount ? Number(barcodeCount) : stockNumber;

            if (
                isNaN(stockNumber) ||
                isNaN(sellingPriceNumber) ||
                isNaN(costPriceNumber) ||
                isNaN(gstNumber) ||
                stockNumber < 0 ||
                sellingPriceNumber <= 0 ||
                barcodeTotal < 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid numeric values"
                });
            }


            const product = await Product.create({
                name: productName,
                costPrice: costPriceNumber,
                sellingPrice: sellingPriceNumber,
                gst: gstNumber,
                stock: stockNumber,
                categoryId,
                unitType,
                unitValue: Number(unitValue) || 1,
                reorderLevel: Number(reorderLevel) || 0,
                damagedStock: 0,
                ...hierarchy
            });


            let barcodes = [];

            if (barcodeTotal > 0) {
                barcodes = await generateUniqueBarcodes(
                    barcodeTotal,
                    hierarchy.superAdminId
                );

                const barcodeDocs = barcodes.map(code => ({
                    productId: product._id,
                    code,
                    isSold: false,
                    superAdminId: hierarchy.superAdminId
                }));

                await Barcode.insertMany(barcodeDocs);
            }

            res.status(201).json({
                success: true,
                message: "Product created successfully",
                data: product,
                totalBarcodes: barcodes.length,
                barcodes
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


router.get("/", verifyToken, authorize("super_admin", "admin", "cashier"), async (req, res) => {
    try {
        const { page = 1, limit = 10, search = "" } = req.query;
        const { userId, role, superAdminId, adminId } = req.user;


        let filter = {
            name: { $regex: search, $options: "i" }
        };

        if (role === "super_admin") {
            filter.superAdminId = userId;
        }

        else if (role === "admin") {
            filter.superAdminId = superAdminId;

        }

        else if (role === "cashier") {
            filter.superAdminId = superAdminId;

        }

        const products = await Product.find(query)
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .sort({ createdAt: -1 });

        const total = await Product.countDocuments(query);

        res.json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            products
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


router.get("/:id", verifyToken, authorize("super_admin", "admin", "cashier"), async (req, res) => {
    try {
        const { userId, role, superAdminId, adminId } = req.user;


        let filter = { _id: req.params.id };

        if (role === "super_admin") {
            filter.superAdminId = userId;
        }

        else if (role === "admin") {
            filter.superAdminId = superAdminId;

        }

        else if (role === "cashier") {
            filter.superAdminId = superAdminId;

        }

        const product = await Product.findOne(filter);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.json({
            success: true,
            product
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

router.put("/:id", verifyToken, authorize("super_admin", "admin", "cashier"), async (req, res) => {
    try {
        const {
            name,
            sellingPrice,
            gst,
            stock, } = req.body;
        const { userId, role, superAdminId, adminId } = req.user;


        let filter = { _id: req.params.id };

        if (role === "super_admin") {
            filter.superAdminId = userId;
        } else if (role === "admin") {
            filter.superAdminId = superAdminId;


        } else if (role === "cashier") {
            filter.superAdminId = superAdminId;

        }

        const product = await Product.findOne(filter);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }


        if (price !== undefined && (isNaN(price) || price <= 0)) {
            return res.status(400).json({
                success: false,
                message: "Price must be a valid number"
            });
        }

        if (gst !== undefined && (isNaN(gst) || gst < 0)) {
            return res.status(400).json({
                success: false,
                message: "GST must be a valid number"
            });
        }

        if (stock !== undefined && (isNaN(stock) || stock < 0)) {
            return res.status(400).json({
                success: false,
                message: "Stock must be a valid number"
            });
        }


        if (name !== undefined) product.name = name;
        if (price !== undefined) product.price = Number(price);
        if (gst !== undefined) product.gst = Number(gst);

        let newBarcodes = [];

        if (stock !== undefined) {
            const newStock = Number(stock);
            const oldStock = product.stock;

            const diff = newStock - oldStock;

            if (diff > 0) {
                const codes = await generateBarcodes(diff);

                newBarcodes = codes;

                const barcodeDocs = codes.map(code => ({
                    productId: product._id,
                    code,
                    isSold: false,
                    superAdminId: superAdminId
                }));

                await Barcode.insertMany(barcodeDocs);
            }

            product.stock = newStock;
        }

        await product.save();

        const barcodes = await Barcode.find({
            productId: product._id
        }).sort({ _id: -1 }).limit(5);

        return res.json({
            success: true,
            message: "Product updated successfully",
            product,
            newBarcodes
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
}
);

router.delete("/:id", verifyToken, authorize("super_admin", "admin", "cashier"), async (req, res) => {
    try {
        const { userId, role, superAdminId, adminId } = req.user;


        let filter = { _id: req.params.id };

        if (role === "super_admin") {
            filter.superAdminId = userId;
        }
        else if (role === "admin") {
            filter.superAdminId = superAdminId;


        }
        else if (role === "cashier") {
            filter.superAdminId = superAdminId;


        }


        const product = await Product.findOne(filter);


        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }


        await Barcode.deleteMany({
            productId: productId,
            superAdminId: superAdminId
        });


        await Product.deleteOne({
            _id: productId,
            superAdminId: superAdminId
        });

        res.status(200).json({
            success: true,
            message: "Product and related barcodes deleted successfully"
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