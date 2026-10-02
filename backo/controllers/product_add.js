const mongoose = require("mongoose");
const Product = require("../models/product");
const PriceHistory = require("../models/price-history");
const Barcode = require("../models/barcode");
const PriceLevel = require("../models/price_level");
const { attachHierarchy } = require("../utils/hierarchy");
const category = require("../models/category");

const Hsn = require("../models/hsn");

const generateItemCode = async (superAdminId) => {
    let code;
    let exists = true;

    while (exists) {
        code = Math.floor(10000 + Math.random() * 90000).toString();

        exists = await Product.findOne({
            itemCode: code,
            superAdminId
        });
    }

    return code;
};

exports.productcreate = async (req, res) => {

    try {
        const {
            name,
            description,
            categoryId,
            hsnCode,
            gstRate,
            mrp,
            unit,
            unitValue,
            costPrice,
            sellingPrice,
            barcode,
            priceLevel,
            productType,
            parentProductId,
            lowStockQty
        } = req.body;

        if (!name || !categoryId) {
            return res.status(400).json({
                success: false,
                message: "Name and Category is required"
            });
        }

        const hierarchy = attachHierarchy(req.user);

        const itemCode = await generateItemCode(hierarchy.superAdminId);

        const cat = await category.findOne({
            _id: categoryId,
            superAdminId: hierarchy.superAdminId
        });

        if (!cat) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        const gstValue =
            gstRate === undefined ||
                gstRate === null ||
                gstRate === ""
                ? 0
                : String(gstRate).trim().toLowerCase();

        let processedGstRate;

        if (gstValue === "none") {
            processedGstRate = "none";
        } else {
            processedGstRate = Number(gstValue);
        }

        const allowedGstRates = [0, 5, 12, 18, 40];

        if (
            processedGstRate !== "none" &&
            (
                isNaN(processedGstRate) ||
                !allowedGstRates.includes(processedGstRate)
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "GST rate must be 0, 5, 12, 18, 40 or none"
            });
        }

        const allowedUnits = ["pcs", "kg", "g"];

        let finalUnit = unit
            ? String(unit).trim().toLowerCase()
            : "pcs";

        if (finalUnit === "gram" || finalUnit === "grams") {
            finalUnit = "g";
        }

        const finalUnitValue =
            unitValue !== undefined && unitValue !== null && unitValue !== ""
                ? Number(unitValue)
                : undefined;

        if (!allowedUnits.includes(finalUnit)) {
            return res.status(400).json({
                success: false,
                message: "Unit must be pcs, kg or g"
            });
        }

        if (
            finalUnitValue !== undefined &&
            (isNaN(finalUnitValue) || finalUnitValue <= 0)
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid unitValue is required"
            });
        }

        const processedMrp = Number(mrp || 0);

        const allowedProductTypes = ["normal", "bulk", "repack"];

        const finalProductType = productType
            ? String(productType).trim().toLowerCase()
            : "normal";

        if (!allowedProductTypes.includes(finalProductType)) {
            return res.status(400).json({
                success: false,
                message: "Product type must be normal, bulk or repack"
            });
        }
        let finalParentProductId = null;

        if (finalProductType === "repack") {
            if (!parentProductId) {
                return res.status(400).json({
                    success: false,
                    message: "Parent bulk product required for repack product"
                });
            }

            const parentProduct = await Product.findOne({
                _id: parentProductId,
                productType: "bulk",
                superAdminId: hierarchy.superAdminId
            });

            if (!parentProduct) {
                return res.status(404).json({
                    success: false,
                    message: "Parent bulk product not found"
                });
            }

            finalParentProductId = parentProductId;
        }


        const processedCostPrice = Number(costPrice || 0);
        const processedSellingPrice = Number(sellingPrice || 0);

        const processedLowStockQty = Number(lowStockQty || 10);

        if (isNaN(processedLowStockQty) || processedLowStockQty < 0) {
            return res.status(400).json({
                success: false,
                message: "Valid low stock qty is required"
            });
        }

        let barcodeCode = "";

        if (barcode) {
            barcodeCode = String(barcode).trim();

            const existingBarcode = await Barcode.findOne({
                code: barcodeCode,
                superAdminId: hierarchy.superAdminId
            });

            if (existingBarcode) {
                return res.status(400).json({
                    success: false,
                    message: "Barcode already exists"
                });
            }
        }


        const product = await Product.create({
            name: String(name).trim(),
            itemCode,


            description: description
                ? String(description).trim()
                : "",

            stock: 0,
            lowStockQty: processedLowStockQty,
            reservedStock: 0,

            mrp: processedMrp,

            unit: finalUnit,
            ...(finalUnitValue !== undefined && { unitValue: finalUnitValue }),

            costPrice: processedCostPrice,
            sellingPrice: processedSellingPrice,

            categoryId,
            categoryName: cat.name || "",

            hsnCode: hsnCode ? String(hsnCode).trim() : "",
            gstRate: processedGstRate,

            productType: finalProductType,
            parentProductId: finalParentProductId,

            ...hierarchy,
            createdBy: req.user.userId
        });



        let createdBarcode = null;

        if (barcode) {
            const barcodeCode = String(barcode).trim();



            createdBarcode = await Barcode.create({
                productId: product._id,
                code: barcodeCode,

                qty: 0,
                availableQty: 0,

                mrp: processedMrp,

                unit: finalUnit,
                ...(finalUnitValue !== undefined && { unitValue: finalUnitValue }),

                costPrice: processedCostPrice,
                sellingPrice: processedSellingPrice,
                gstRate: processedGstRate,

                isSold: false,

                ...hierarchy,
                createdBy: req.user.userId
            });
        }

        let createdPriceLevel = null;

        if (priceLevel) {
            createdPriceLevel = await PriceLevel.findOneAndUpdate(
                {
                    productId: product._id,
                    superAdminId: hierarchy.superAdminId
                },
                {
                    productId: product._id,
                    pricingType: priceLevel.pricingType || "slab",
                    manualPrice: priceLevel.manualPrice || 0,
                    autoPricing: priceLevel.autoPricing || {
                        baseOn: "costPrice",
                        profitPercent: 0
                    },
                    slabs: priceLevel.slabs || [],

                    ...hierarchy,
                    createdBy: req.user.userId,
                    isActive: true
                },
                {
                    upsert: true,
                    returnDocument: "after",
                    runValidators: true
                }
            );
        }

        res.status(201).json({
            success: true,
            message: "Product created successfully",
            data: {
                product,
                barcode: createdBarcode,
                priceLevel: createdPriceLevel
            }
        });


    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "Product already exists"
            });
        }

        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};


exports.bulkProductCreate = async (req, res) => {
    try {
        const { products } = req.body;

        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Products array is required"
            });
        }

        const hierarchy = attachHierarchy(req.user);

        const allowedGstRates = [0, 5, 12, 18, 40];
        const allowedUnits = ["pcs", "kg", "g"];

        const createdProducts = [];
        const errors = [];
        const requestBarcodes = new Set();

        for (let i = 0; i < products.length; i++) {
            try {
                const item = products[i];

                const name = item.name ? String(item.name).trim() : "";

                const brand = item.brand ? String(item.brand).trim() : "";
                const description = item.description ? String(item.description).trim() : "";
                const categoryId = item.categoryId;

                const hsnCode = item.hsnCode ? String(item.hsnCode).trim() : "";
                const barcodeCode = item.barcode ? String(item.barcode).trim() : "";

                if (!name || !categoryId) {
                    errors.push({
                        row: i + 1,
                        name,
                        barcode: barcodeCode,
                        message: "Name and category required"
                    });
                    continue;
                }

                const cat = await category.findOne({
                    _id: categoryId,
                    superAdminId: hierarchy.superAdminId
                });

                if (!cat) {
                    errors.push({
                        row: i + 1,
                        name,
                        barcode: barcodeCode,
                        message: "Category not found"
                    });
                    continue;
                }

                const gstValue =
                    item.gstRate === undefined ||
                        item.gstRate === null ||
                        item.gstRate === ""
                        ? 0
                        : String(item.gstRate).trim().toLowerCase();

                let processedGstRate;

                if (gstValue === "none") {
                    processedGstRate = "none";
                } else {
                    processedGstRate = Number(gstValue);
                }

                if (
                    processedGstRate !== "none" &&
                    (
                        isNaN(processedGstRate) ||
                        !allowedGstRates.includes(processedGstRate)
                    )
                ) {
                    errors.push({
                        row: i + 1,
                        name,
                        barcode: barcodeCode,
                        message: "GST rate must be 0, 5, 12, 18, 40 or none"
                    });
                    continue;
                }

                let finalUnit = item.unit
                    ? String(item.unit).trim().toLowerCase()
                    : "pcs";

                if (finalUnit === "gram" || finalUnit === "grams") {
                    finalUnit = "g";
                }

                if (!allowedUnits.includes(finalUnit)) {
                    errors.push({
                        row: i + 1,
                        name,
                        barcode: barcodeCode,
                        message: "Unit must be pcs, kg or g"
                    });
                    continue;
                }

                const finalUnitValue =
                    item.unitValue !== undefined &&
                        item.unitValue !== null &&
                        item.unitValue !== ""
                        ? Number(item.unitValue)
                        : undefined;

                if (
                    finalUnitValue !== undefined &&
                    (isNaN(finalUnitValue) || finalUnitValue <= 0)
                ) {
                    errors.push({
                        row: i + 1,
                        name,
                        barcode: barcodeCode,
                        message: "Valid unitValue is required"
                    });
                    continue;
                }

                const processedMrp = Number(item.mrp || 0);

                const allowedProductTypes = ["normal", "bulk", "repack"];

                const finalProductType = item.productType
                    ? String(item.productType).trim().toLowerCase()
                    : "normal";

                if (!allowedProductTypes.includes(finalProductType)) {
                    errors.push({
                        row: i + 1,
                        name,
                        barcode: barcodeCode,
                        message: "Product type must be normal, bulk or repack"
                    });
                    continue;
                }

                let finalParentProductId = null;

                if (finalProductType === "repack") {
                    if (!item.parentProductId) {
                        errors.push({
                            row: i + 1,
                            name,
                            barcode: barcodeCode,
                            message: "Parent bulk product required for repack product"
                        });
                        continue;
                    }

                    const parentProduct = await Product.findOne({
                        _id: item.parentProductId,
                        productType: "bulk",
                        superAdminId: hierarchy.superAdminId
                    });

                    if (!parentProduct) {
                        errors.push({
                            row: i + 1,
                            name,
                            barcode: barcodeCode,
                            message: "Parent bulk product not found"
                        });
                        continue;
                    }

                    finalParentProductId = item.parentProductId;
                }


                const processedCostPrice = Number(item.costPrice || 0);
                const processedSellingPrice = Number(item.sellingPrice || 0);
                const processedLowStockQty = Number(item.lowStockQty || 10);

                if (isNaN(processedLowStockQty) || processedLowStockQty < 0) {
                    errors.push({
                        row: i + 1,
                        name,
                        barcode: barcodeCode,
                        message: "Valid low stock qty is required"
                    });
                    continue;
                }

                if (barcodeCode) {
                    if (requestBarcodes.has(barcodeCode)) {
                        errors.push({
                            row: i + 1,
                            name,
                            barcode: barcodeCode,
                            message: "Duplicate barcode in request"
                        });
                        continue;
                    }

                    requestBarcodes.add(barcodeCode);

                    const existingBarcode = await Barcode.findOne({
                        code: barcodeCode,
                        superAdminId: hierarchy.superAdminId
                    });

                    if (existingBarcode) {
                        errors.push({
                            row: i + 1,
                            name,
                            barcode: barcodeCode,
                            message: "Barcode already exists"
                        });
                        continue;
                    }
                }

                const itemCode = await generateItemCode(hierarchy.superAdminId);

                const product = await Product.create({

                    itemCode,
                    name,
                    brand,
                    description,

                    productType: finalProductType,
                    parentProductId: finalParentProductId,

                    stock: 0,
                    lowStockQty: processedLowStockQty,
                    reservedStock: 0,

                    mrp: processedMrp,

                    unit: finalUnit,
                    ...(finalUnitValue !== undefined && {
                        unitValue: finalUnitValue
                    }),

                    costPrice: processedCostPrice,
                    sellingPrice: processedSellingPrice,

                    categoryId,
                    categoryName: cat.name || "",

                    hsnCode,
                    gstRate: processedGstRate,

                    ...hierarchy,
                    createdBy: req.user.userId
                });

                let createdBarcode = null;

                if (barcodeCode) {
                    createdBarcode = await Barcode.create({
                        productId: product._id,
                        code: barcodeCode,

                        qty: 0,
                        availableQty: 0,

                        mrp: processedMrp,

                        unit: finalUnit,
                        ...(finalUnitValue !== undefined && {
                            unitValue: finalUnitValue
                        }),

                        costPrice: processedCostPrice,
                        sellingPrice: processedSellingPrice,
                        gstRate: processedGstRate,

                        isSold: false,

                        ...hierarchy,
                        createdBy: req.user.userId
                    });
                }

                let createdPriceLevel = null;

                if (item.priceLevel) {
                    createdPriceLevel = await PriceLevel.findOneAndUpdate(
                        {
                            productId: product._id,
                            superAdminId: hierarchy.superAdminId
                        },
                        {
                            productId: product._id,
                            pricingType: item.priceLevel.pricingType || "slab",
                            manualPrice: item.priceLevel.manualPrice || 0,
                            autoPricing: item.priceLevel.autoPricing || {
                                baseOn: "costPrice",
                                profitPercent: 0
                            },
                            slabs: item.priceLevel.slabs || [],

                            ...hierarchy,
                            createdBy: req.user.userId,
                            isActive: true
                        },
                        {
                            upsert: true,
                            new: true,
                            runValidators: true
                        }
                    );
                }

                createdProducts.push({
                    row: i + 1,
                    product,
                    barcode: createdBarcode,
                    priceLevel: createdPriceLevel
                });

            } catch (err) {
                errors.push({
                    row: i + 1,
                    message: err.code === 11000
                        ? "Duplicate product or barcode"
                        : err.message
                });
            }
        }

        return res.status(201).json({
            success: true,
            message: "Bulk product add completed",
            total: products.length,
            createdCount: createdProducts.length,
            errorCount: errors.length,
            data: createdProducts,
            errors
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

exports.getproductMrps = async (req, res) => {
    try {
        const { productId } = req.params;

        const hierarchy = attachHierarchy(req.user);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.json({
            success: true,
            productId: product._id,
            name: product.name,
            brand: product.brand,

            mrps: product.variants.map(v => ({
                variantId: v._id,
                mrp: v.mrp
            }))
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

exports.getProductsByType = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);
        const { productType } = req.query;

        const allowedProductTypes = ["normal", "bulk", "repack"];

        if (!productType || !allowedProductTypes.includes(productType)) {
            return res.status(400).json({
                success: false,
                message: "productType must be normal, bulk or repack"
            });
        }

        const products = await Product.find({
            superAdminId: hierarchy.superAdminId,
            productType
        })
            .populate("categoryId", "name")
            .populate("parentProductId", "name productType unit unitValue stock")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: `${productType} products fetched successfully`,
            count: products.length,
            data: products
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

exports.allProducts = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        let products = await Product.find({
            superAdminId: hierarchy.superAdminId
        })
            .populate("categoryId", "name")
            .sort({ createdAt: -1 })
            .lean();

        products = await Promise.all(
            products.map(async (product) => {
                const barcodes = await Barcode.find({
                    productId: product._id,
                    superAdminId: hierarchy.superAdminId
                })
                    .sort({ createdAt: -1 })
                    .lean();

                const priceLevel = await PriceLevel.findOne({
                    productId: product._id,
                    superAdminId: hierarchy.superAdminId,
                    isActive: true
                }).lean();

                const priceHistory = await PriceHistory.find({
                    productId: product._id,
                    superAdminId: hierarchy.superAdminId
                })
                    .sort({ createdAt: -1 })
                    .lean();



                return {
                    ...product,

                    barcodeCount: barcodes.length,

                    barcodes: barcodes.map((barcode) => ({
                        barcodeId: barcode._id,
                        barcode: barcode.code || "",
                        productId: barcode.productId
                    })),

                    priceLevel: priceLevel
                        ? {
                            pricingType: priceLevel.pricingType,
                            manualPrice: priceLevel.manualPrice,
                            autoPricing: priceLevel.autoPricing,
                            slabs: priceLevel.slabs
                        }
                        : null,

                    priceHistory
                };
            })
        );



        return res.status(200).json({
            success: true,
            message: "Products fetched successfully",
            count: products.length,
            data: products
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};


exports.searchProducts = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);
        const { search } = req.query;

        if (!search) {
            return res.status(400).json({
                success: false,
                message: "Search value is required"
            });
        }

        const searchRegex = new RegExp(search, "i");

        const matchingBarcodes = await Barcode.find({
            superAdminId: hierarchy.superAdminId,
            code: searchRegex
        })
            .select("productId code")
            .lean();

        const barcodeProductIds = matchingBarcodes
            .map(barcode => barcode.productId)
            .filter(Boolean);

        const products = await Product.find({
            superAdminId: hierarchy.superAdminId,
            isActive: { $ne: false },
            $or: [
                { name: { $regex: search, $options: "i" } },
                { itemCode: { $regex: search, $options: "i" } },
                { hsnCode: { $regex: search, $options: "i" } },
                { _id: { $in: barcodeProductIds } }
            ]
        })
            .populate("categoryId", "name hsnCode gstRate")
            .sort({ createdAt: -1 })
            .limit(20);

        const data = await Promise.all(
            products.map(async (product) => {

                const priceHistory = await PriceHistory.find({
                    productId: product._id,
                    superAdminId: hierarchy.superAdminId
                })
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .lean();

                const barcodes = await Barcode.find({
                    productId: product._id,
                    superAdminId: hierarchy.superAdminId
                })
                    .select("code productId")
                    .lean();

                return {
                    productId: product._id,
                    productName: product.name || "",
                    itemCode: product.itemCode || "",

                    barcodes,

                    stock: Number(product.stock || 0),
                    reservedStock: Number(product.reservedStock || 0),

                    categoryId: product.categoryId?._id || "",
                    categoryName: product.categoryId?.name || "",

                    hsnCode: product.hsnCode || product.categoryId?.hsnCode || "",

                    gstRate:
                        product.gstRate !== undefined &&
                            product.gstRate !== null &&
                            product.gstRate !== ""
                            ? product.gstRate
                            : product.categoryId?.gstRate ?? 0,

                    costPrice: Number(product.costPrice || 0),
                    sellingPrice: Number(product.sellingPrice || 0),

                    mrp:
                        product.mrps?.length > 0
                            ? Number(product.mrps[0].mrp || 0)
                            : 0,

                    unitValue: Number(product.unitValue || 0),
                    unit: product.unit || "",

                    mrp: Number(product.mrp || 0),

                    status:
                        Number(product.stock || 0) <= 0
                            ? "Out Of Stock"
                            : Number(product.stock || 0) <= 10
                                ? "Low Stock"
                                : "Available",

                    priceHistory
                };
            })
        );


        return res.status(200).json({
            success: true,
            count: data.length,
            data
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};


exports.searchProductsByCategory = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);
        const { categoryId } = req.params;
        const { search } = req.query;

        const cat = await category.findOne({
            _id: categoryId,
            superAdminId: hierarchy.superAdminId,
            isActive: true
        });

        if (!cat) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        const filter = {
            superAdminId: hierarchy.superAdminId,
            categoryId: cat._id,
            isActive: { $ne: false }
        };

        if (search) {
            const categoryName = String(cat.name || "").toLowerCase();
            const searchValue = String(search || "").toLowerCase();

            if (!categoryName.includes(searchValue)) {
                filter.$or = [
                    { name: { $regex: search, $options: "i" } },
                    { brand: { $regex: search, $options: "i" } },
                    { hsnCode: { $regex: search, $options: "i" } }
                ];
            }
        }

        const products = await Product.find(filter)
            .populate("categoryId", "name hsnCode gstRate")
            .sort({ createdAt: -1 });

        const data = products.map((product) => ({
            productId: product._id,
            productName: product.name || "",
            brand: product.brand || "",
            stock: Number(product.stock || 0),
            reservedStock: Number(product.reservedStock || 0),

            categoryId: product.categoryId?._id || "",
            categoryName: product.categoryId?.name || "",

            hsnCode: product.hsnCode || product.categoryId?.hsnCode || "",
            gstRate: Number(product.gstRate || product.categoryId?.gstRate || 0),


            mrps: product.mrps || [],

            status:
                Number(product.stock || 0) <= 0
                    ? "Out Of Stock"
                    : Number(product.stock || 0) <= 10
                        ? "Low Stock"
                        : "Available"
        }));

        return res.status(200).json({
            success: true,
            category: {
                categoryId: cat._id,
                categoryName: cat.name,
                hsnCode: cat.hsnCode,
                gstRate: cat.gstRate
            },
            count: data.length,
            data
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};


exports.ProductsById = async (req, res) => {
    try {
        const { id } = req.params;
        const hierarchy = attachHierarchy(req.user);



        const product = await Product.findOne({
            _id: id,
            superAdminId: hierarchy.superAdminId
        })
            .populate("categoryId", "name hsnCode gstRate")
            .populate("hsnId", "hsnCode gstRate cgst sgst igst cess")
            .lean();

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        const barcodes = await Barcode.find({
            productId: product._id,
            superAdminId: hierarchy.superAdminId
        })
            .sort({ createdAt: -1 })
            .lean();

        const priceLevel = await PriceLevel.findOne({
            productId: product._id,
            superAdminId: hierarchy.superAdminId,
            isActive: true
        }).lean();



        const priceHistory = await PriceHistory.find({
            productId: product._id,
            superAdminId: hierarchy.superAdminId
        })
            .sort({ createdAt: -1 })
            .lean();



        return res.status(200).json({
            success: true,
            data: {
                ...product,
                itemCode: product.itemCode,
                productType: product.productType,
                parentProductId: product.parentProductId || null,

                lowStockQty: product.lowStockQty || 10,

                mrp: product.mrp || 0,
                unit: product.unit || "pcs",
                costPrice: product.costPrice || 0,
                sellingPrice: product.sellingPrice || 0,

                priceLevel: priceLevel || null,

                hsnCode: product.hsnCode || "",
                gstRate: product.gstRate ?? "none",

                categoryId: product.categoryId
                    ? {
                        _id: product.categoryId._id,
                        name: product.categoryId.name
                    }
                    : null,

                categoryName: product.categoryId?.name || "",

                hsnId: product.hsnId || null,

                superAdminId: product.superAdminId,
                adminId: product.adminId || null,
                createdBy: product.createdBy,

                createdAt: product.createdAt,
                updatedAt: product.updatedAt,



                barcodeCount: barcodes.length,

                barcodes: barcodes.map((barcode) => ({
                    barcodeId: barcode._id,
                    barcode: barcode.code || "",

                    productId: barcode.productId
                })),


                priceHistory
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

exports.getAllPriceHistory = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const history = await PriceHistory.find({
            superAdminId: hierarchy.superAdminId
        })
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            count: history.length,
            data: history
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

exports.getProductPriceHistoryById = async (req, res) => {
    try {
        const { productId } = req.params;

        const history = await PriceHistory.find({
            productId
        })
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            count: history.length,
            data: history
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};


exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            name,
            description,
            categoryId,
            hsnCode,
            gstRate,
            mrp,
            unit,
            unitValue,
            lowStockQty,
            costPrice,
            sellingPrice,
            barcode
        } = req.body;

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
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }


        const oldCostPrice = Number(product.costPrice || 0);
        const oldSellingPrice = Number(product.sellingPrice || 0);
        const oldMrp = Number(product.mrp || 0);


        if (categoryId) {
            const cat = await category.findOne({
                _id: categoryId,
                superAdminId: hierarchy.superAdminId
            });

            if (!cat) {
                return res.status(404).json({
                    success: false,
                    message: "Category not found"
                });
            }

            product.categoryId = categoryId;
            product.categoryName = cat.name || "";
        }

        if (name) product.name = String(name).trim();

        if (description !== undefined) {
            product.description = String(description).trim();
        }

        if (hsnCode !== undefined) {
            product.hsnCode = hsnCode ? String(hsnCode).trim() : "";
        }

        if (gstRate !== undefined) {
            const gstValue =
                gstRate === null ||
                    gstRate === ""
                    ? 0
                    : String(gstRate).trim().toLowerCase();

            let processedGstRate;

            if (gstValue === "none") {
                processedGstRate = "none";
            } else {
                processedGstRate = Number(gstValue);
            }

            const allowedGstRates = [0, 5, 12, 18, 40];

            if (
                processedGstRate !== "none" &&
                (
                    isNaN(processedGstRate) ||
                    !allowedGstRates.includes(processedGstRate)
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message: "GST rate must be 0, 5, 12, 18, 40 or none"
                });
            }

            product.gstRate = processedGstRate;
        }

        if (mrp !== undefined) {
            const processedMrp = Number(mrp);

            if (isNaN(processedMrp) || processedMrp < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Valid MRP is required"
                });
            }

            product.mrp = processedMrp;
        }

        const allowedUnits = ["pcs", "kg", "g"];

        if (unit !== undefined) {
            let finalUnit = String(unit).trim().toLowerCase();

            if (finalUnit === "gram" || finalUnit === "grams") {
                finalUnit = "g";
            }

            if (!allowedUnits.includes(finalUnit)) {
                return res.status(400).json({
                    success: false,
                    message: "Unit must be pcs, kg or g"
                });
            }

            product.unit = finalUnit;
        }

        if (unitValue !== undefined) {
            const processedUnitValue = Number(unitValue);

            if (isNaN(processedUnitValue) || processedUnitValue <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Valid unitValue is required"
                });
            }

            product.unitValue = processedUnitValue;
        }

        if (lowStockQty !== undefined) {
            const processedLowStockQty = Number(lowStockQty);

            if (isNaN(processedLowStockQty) || processedLowStockQty < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Valid low stock qty is required"
                });
            }

            product.lowStockQty = processedLowStockQty;
        }

        if (costPrice !== undefined) {
            const processedCostPrice = Number(costPrice);

            if (isNaN(processedCostPrice) || processedCostPrice < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Valid cost price is required"
                });
            }

            product.costPrice = processedCostPrice;
        }

        if (sellingPrice !== undefined) {
            const processedSellingPrice = Number(sellingPrice);

            if (isNaN(processedSellingPrice) || processedSellingPrice < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Valid selling price is required"
                });
            }

            product.sellingPrice = processedSellingPrice;
        }

        if (
            product.mrp &&
            product.costPrice !== undefined &&
            product.costPrice > product.mrp
        ) {
            return res.status(400).json({
                success: false,
                message: "Cost price cannot be greater than MRP"
            });
        }

        if (
            product.mrp &&
            product.sellingPrice !== undefined &&
            product.sellingPrice > product.mrp
        ) {
            return res.status(400).json({
                success: false,
                message: "Selling price cannot be greater than MRP"
            });
        }

        product.updatedBy = req.user.userId || req.user.id;

        let updatedBarcode = null;

        if (barcode !== undefined) {

            const barcodeCode =
                barcode === null
                    ? ""
                    : String(barcode).trim();

            if (barcodeCode === "") {

                await Barcode.deleteMany({
                    productId: product._id,
                    superAdminId: hierarchy.superAdminId
                });

            } else {

                const duplicate = await Barcode.findOne({
                    code: barcodeCode,
                    superAdminId: hierarchy.superAdminId,
                    productId: { $ne: product._id }
                });

                if (duplicate) {
                    return res.status(400).json({
                        success: false,
                        message: "Barcode already exists"
                    });
                }

                const existingBarcode = await Barcode.findOne({
                    productId: product._id,
                    superAdminId: hierarchy.superAdminId
                });


                if (existingBarcode) {
                    existingBarcode.code = barcodeCode;
                    await existingBarcode.save();

                    updatedBarcode = existingBarcode;
                } else {
                    createdBarcode = await Barcode.create({
                        productId: product._id,
                        code: barcodeCode,

                        qty: 0,
                        availableQty: 0,

                        mrp: product.mrp || 0,
                        costPrice: product.costPrice || 0,
                        sellingPrice: product.sellingPrice || 0,
                        gstRate: product.gstRate,

                        unit: product.unit || "pcs",
                        unitValue: product.unitValue || 1,

                        isSold: false,

                        ...hierarchy,
                        createdBy: req.user.userId || req.user.id
                    });
                }
            }
        }


        const newCostPrice = Number(product.costPrice || 0);
        const newSellingPrice = Number(product.sellingPrice || 0);
        const newMrp = Number(product.mrp || 0);

        if (
            oldCostPrice !== newCostPrice ||
            oldSellingPrice !== newSellingPrice ||
            oldMrp !== newMrp
        ) {
            await PriceHistory.create({
                productId: product._id,
                itemCode: product.itemCode,
                productName: product.name,

                oldCostPrice,
                newCostPrice,

                oldSellingPrice,
                newSellingPrice,

                oldMrp,
                newMrp,

                changedBy: req.user.userId || req.user.id,
                superAdminId: hierarchy.superAdminId
            });
        }



        await product.save();

        await Barcode.updateMany(
            {
                productId: product._id,
                superAdminId: hierarchy.superAdminId
            },
            {
                $set: {
                    mrp: product.mrp,
                    costPrice: product.costPrice,
                    sellingPrice: product.sellingPrice,
                    gstRate: product.gstRate,
                    unit: product.unit,
                    unitValue: product.unitValue
                }
            }
        );

        const barcodes = await Barcode.find({
            productId: product._id,
            superAdminId: hierarchy.superAdminId
        }).lean();

        return res.json({
            success: true,
            message: "Product updated successfully",
            data: {
                product,
                barcode: updatedBarcode,
                barcodes
            }
        });

    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "Product or barcode already exists"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};



exports.deleteAllProducts = async (req, res) => {

    try {

        const hierarchy = attachHierarchy(req.user);

        const result = await Product.deleteMany({
            superAdminId: hierarchy.superAdminId
        });

        res.json({
            success: true,
            message: "All products deleted successfully",
            deletedCount: result.deletedCount
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

exports.deleteProduct = async (req, res) => {

    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product id"
            });
        }

        const hierarchy = attachHierarchy(req.user);

        const product = await Product.findOneAndDelete({
            _id: id,
            superAdminId: hierarchy.superAdminId
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.json({
            success: true,
            message: "Product deleted successfully"
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};