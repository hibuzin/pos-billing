const Product = require("../models/product");
const mongoose = require("mongoose");
const Purchase = require("../models/purchase");
const Barcode = require("../models/barcode");
const Bill = require("../models/bill");
const ComboOffer = require("../models/combo_offer");
const { attachHierarchy } = require("../utils/hierarchy");


exports.allstockcheck = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const products = await Product.find({
            superAdminId: hierarchy.superAdminId
        }).lean();

        const barcodes = await Barcode.find({
            superAdminId: hierarchy.superAdminId
        })
            .select("productId code")
            .lean();

        const data = [];

        const formatQty = (value) => {
            const num = Number(value || 0);

            return Number.isInteger(num)
                ? String(num)
                : String(Number(num.toFixed(2)));
        };

        // Group barcodes by product
        const barcodeMap = new Map();

        for (const barcode of barcodes) {
            if (!barcode.productId) continue;

            const productId = String(barcode.productId);

            if (!barcodeMap.has(productId)) {
                barcodeMap.set(productId, []);
            }

            barcodeMap.get(productId).push(barcode);
        }

        for (const product of products) {
            const productId = String(product._id);

            const productBarcodes =
                barcodeMap.get(productId) || [];


            const currentStock = Number(
                Number(product.stock || 0).toFixed(2)
            );

            const unit = product.unit || "pcs";

            const unitValue = Number(
                product.unitValue ?? 1
            );

            const safeUnitValue =
                unitValue > 0 ? unitValue : 1;

            const costPrice = Number(
                product.costPrice || 0
            );

            // -----------------------------------------
            // STOCK TEXT
            // -----------------------------------------

            let totalStockText = "";

            if (unit === "kg") {
                totalStockText =
                    `${formatQty(currentStock)} kg`;

            } else if (unit === "g") {
                totalStockText =
                    `${formatQty(currentStock / 1000)} kg`;

            } else {
                totalStockText =
                    `${formatQty(currentStock)} pcs`;
            }

            // -----------------------------------------
            // STOCK VALUE
            // -----------------------------------------

            let stockValue = 0;

            if (unit === "kg") {
                stockValue =
                    currentStock * costPrice;

            } else if (unit === "g") {
                stockValue =
                    (currentStock / 1000) * costPrice;

            } else {
                stockValue =
                    currentStock * costPrice;
            }

            stockValue = Number(
                stockValue.toFixed(2)
            );

            // -----------------------------------------
            // STOCK STATUS
            // -----------------------------------------

            let status = "Available";

            if (currentStock <= 0) {
                status = "Out Of Stock";
            } else if (
                currentStock <= Number(product.lowStockQty || 10)
            ) {
                status = "Low Stock";
            }

            // -----------------------------------------
            // BARCODE PRODUCTS
            // -----------------------------------------

            if (productBarcodes.length > 0) {
                for (const barcode of productBarcodes) {
                    data.push({
                        productId: product._id,

                        productName:
                            product.name || "",

                        itemCode:
                            product.itemCode || "",

                        barcode:
                            barcode.code || null,

                        // Product.stock is the actual stock
                        totalQty: currentStock,

                        currentStock,


                        soldQty: 0,

                        actualStockQty:
                            currentStock,

                        totalStockText,

                        stockValue,

                        mrp:
                            product.mrp || 0,

                        costPrice,

                        sellingPrice:
                            product.sellingPrice || 0,

                        gst:
                            product.gstRate ?? "none",

                        unit,

                        unitValue,

                        unitText:
                            `${safeUnitValue} ${unit}`,

                        status
                    });
                }
            }

            // -----------------------------------------
            // NORMAL PRODUCTS WITHOUT BARCODE
            // -----------------------------------------

            else {
                data.push({
                    productId: product._id,

                    productName:
                        product.name || "",

                    itemCode:
                        product.itemCode || "",

                    barcode: null,

                    totalQty: currentStock,

                    currentStock,

                    soldQty: 0,

                    actualStockQty:
                        currentStock,

                    totalStockText,

                    stockValue,

                    mrp:
                        product.mrp || 0,

                    costPrice,

                    sellingPrice:
                        product.sellingPrice || 0,

                    gst:
                        product.gstRate ?? "none",

                    unit,

                    unitValue,

                    unitText:
                        `${safeUnitValue} ${unit}`,

                    status
                });
            }
        }

        // -----------------------------------------
        // SORT
        // -----------------------------------------

        data.sort((a, b) => {
            return String(b.productId).localeCompare(
                String(a.productId)
            );
        });

        // -----------------------------------------
        // TOTAL STOCK VALUE
        // -----------------------------------------

        const totalStockValue = Number(
            data
                .reduce(
                    (sum, item) =>
                        sum +
                        Number(item.stockValue || 0),
                    0
                )
                .toFixed(2)
        );

        return res.status(200).json({
            success: true,
            count: data.length,
            totalStockValue,
            data
        });

    } catch (err) {
        console.error(
            "allstockcheck error:",
            err
        );

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};


exports.getAllRepackStock = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const products = await Product.find({
            superAdminId: hierarchy.superAdminId,
            productType: "repack"
        }).lean();



        const barcodes = await Barcode.find({
            superAdminId: hierarchy.superAdminId
        }).lean();

        const data = [];

        const formatQty = (value) => {
            const num = Number(value || 0);
            return Number.isInteger(num)
                ? String(num)
                : String(Number(num.toFixed(2)));
        };

        const barcodeMap = new Map();

        for (const barcode of barcodes) {
            if (!barcode.productId) continue;

            const productId = String(barcode.productId);

            if (!barcodeMap.has(productId)) {
                barcodeMap.set(productId, []);
            }

            barcodeMap.get(productId).push(barcode);
        }



        for (const product of products) {

            const productId = String(product._id);

            const productBarcodes =
                barcodeMap.get(productId) || [];



            if (productBarcodes.length > 0) {

                for (const barcode of productBarcodes) {


                    const currentStock = Number(
                        Number(product.stock || 0).toFixed(2)
                    );

                    const totalQty = currentStock;

                    const soldQty = 0;

                    const costPrice = Number(barcode.costPrice || product.costPrice || 0);
                    const sellingPrice = Number(barcode.sellingPrice || product.sellingPrice || 0);

                    const stockValue = Number((currentStock * costPrice).toFixed(2));

                    data.push({
                        productId: product._id,
                        bulkProductId: product.parentProductId,

                        productName: product.name,

                        itemCode: product.itemCode || "",

                        barcode: barcode.code,

                        totalQty,
                        currentStock,
                        soldQty,

                        mrp: barcode.mrp || product.mrp || 0,
                        costPrice: barcode.costPrice || product.costPrice || 0,
                        sellingPrice: barcode.sellingPrice || product.sellingPrice || 0,
                        gstRate: barcode.gstRate || product.gstRate || 0,

                        stockValue,

                        unit: barcode.unit,
                        unitValue: barcode.unitValue,
                        unitText: `${barcode.unitValue} ${barcode.unit}`,

                        status:
                            currentStock <= 0
                                ? "Out Of Stock"
                                : currentStock <= Number(product.lowStockQty ?? 10)
                                    ? "Low Stock"
                                    : "Available"
                    });
                }
            }

            else {

                const currentStock = Number(
                    Number(product.stock || 0).toFixed(2)
                );

                const totalQty = currentStock;

                const soldQty = 0;

                const unit =
                    product.unit || "pcs";

                const unitValue = Number(
                    product.unitValue || 1
                );

                let totalStockText = "";

                if (unit === "kg") {

                    totalStockText =
                        `${formatQty(
                            currentStock * unitValue
                        )} kg`;

                } else if (unit === "g") {

                    totalStockText =
                        `${formatQty(
                            (currentStock * unitValue) / 1000
                        )} kg`;

                } else {

                    totalStockText =
                        `${formatQty(currentStock)} pcs`;
                }

                const costPrice = Number(
                    product.costPrice || 0
                );

                const sellingPrice = Number(
                    product.sellingPrice || 0
                );

                const stockValue = Number(
                    (currentStock * costPrice).toFixed(2)
                );

                data.push({

                    productId: product._id,

                    bulkProductId:
                        product.parentProductId || null,

                    productName:
                        product.name || "",

                    itemCode:
                        product.itemCode || "",


                    barcode: null,

                    totalQty,

                    currentStock,

                    soldQty,

                    totalStockText,

                    mrp:
                        product.mrp || 0,

                    costPrice,

                    sellingPrice,

                    gstRate:
                        product.gstRate || 0,

                    stockValue,

                    unit,

                    unitValue,

                    unitText:
                        `${unitValue} ${unit}`,

                    status:
                        currentStock <= 0
                            ? "Out Of Stock"
                            : currentStock <= Number(product.lowStockQty ?? 10)
                                ? "Low Stock"
                                : "Available"
                });
            }
        }



        data.sort((a, b) => {
            return String(b.productId).localeCompare(
                String(a.productId)
            );
        });

        return res.status(200).json({
            success: true,
            count: data.length,
            data
        });

    } catch (err) {

        console.error(
            "getAllRepackStock error:",
            err
        );

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};



exports.getAllBulkProducts = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const bulkProducts = await Product.find({
            superAdminId: hierarchy.superAdminId,
            productType: "bulk"
        })
            .select(

                "name itemCode stock unit unitValue mrp costPrice sellingPrice gstRate lowStockQty"
            )
            .sort({ name: 1 });

        const data = bulkProducts.map((item) => {
            const stock = Number(item.stock || 0);
            const costPrice = Number(item.costPrice || 0);

            return {
                bulkId: item._id,
                productName: item.name,

                itemCode: item.itemCode || "",

                stock,
                unit: item.unit,
                unitValue: item.unitValue,

                mrp: item.mrp || 0,
                costPrice,
                sellingPrice: item.sellingPrice || 0,
                gstRate: item.gstRate ?? "none",

                stockValue: Number((stock * costPrice).toFixed(2)),

                status:
                    stock <= 0
                        ? "Out Of Stock"
                        : stock <= Number(item.lowStockQty ?? 10)
                            ? "Low Stock"
                            : "Available"
            };
        });

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


exports.getAllComboOfferQty = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const comboOffers = await ComboOffer.find({
            superAdminId: hierarchy.superAdminId,
            isActive: true
        })
            .select(
                "_id offerName comboQty comboPrice startDate endDate isActive products"
            )
            .populate("products.productId", "name")
            .sort({ createdAt: -1 });

        const data = comboOffers.map(combo => ({
            comboOfferId: combo._id,
            offerName: combo.offerName,
            comboQty: Number(combo.comboQty || 0),
            comboPrice: Number(combo.comboPrice || 0),
            isAvailable: Number(combo.comboQty || 0) > 0,
            startDate: combo.startDate,
            endDate: combo.endDate,
            products: combo.products.map(item => ({
                productId: item.productId?._id || item.productId,
                name: item.productId?.name || "",
                qty: Number(item.qty || 0)
            }))
        }));

        return res.status(200).json({
            success: true,
            count: data.length,
            data
        });

    } catch (error) {
        console.error("GET ALL COMBO OFFER QTY ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};


exports.stockCheckByBulkId = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);
        const { bulkId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(bulkId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid bulk product id"
            });
        }

        const bulkProduct = await Product.findOne({
            _id: bulkId,
            superAdminId: hierarchy.superAdminId,
            productType: "bulk"
        });

        if (!bulkProduct) {
            return res.status(404).json({
                success: false,
                message: "Bulk product not found"
            });
        }

        const barcodes = await Barcode.find({
            superAdminId: hierarchy.superAdminId
        }).populate(
            "productId",
            "name itemCode stock unit unitValue mrp costPrice sellingPrice parentProductId productType gstRate lowStockQty"
        );

        const formatQty = (value) => {
            const num = Number(value || 0);
            return Number.isInteger(num)
                ? String(num)
                : String(Number(num.toFixed(2)));
        };

        const data = [];

        for (const barcode of barcodes) {
            const product = barcode.productId;

            if (!product) continue;


            if (
                product.productType !== "repack" ||
                String(product.parentProductId) !== String(bulkId)
            ) {
                continue;
            }

            const currentStock = Number(
                Number(product.stock || 0).toFixed(2)
            );

            const totalQty = currentStock;

            const soldQty = 0;

            const costPrice = Number(product.costPrice || 0);
            const stockValue = Number((currentStock * costPrice).toFixed(2));

            data.push({
                productId: product._id,
                productName: product.name,
                barcode: barcode.code,

                currentStock,
                soldQty,
                totalQty,

                costPrice,
                stockValue,

                unit: barcode.unit,
                unitValue: barcode.unitValue,

                gstRate: product.gstRate ?? "none",

                status:
                    currentStock <= 0
                        ? "Out Of Stock"
                        : currentStock <= Number(product.lowStockQty ?? 10)
                            ? "Low Stock"
                            : "Available"
            });
        }

        return res.status(200).json({
            success: true,
            bulkProduct: {
                _id: bulkProduct._id,
                name: bulkProduct.name,
                stock: bulkProduct.stock,
                unit: bulkProduct.unit,
                unitValue: bulkProduct.unitValue
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

exports.getStockValue = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const round2 = (num) =>
            Math.round((Number(num) + Number.EPSILON) * 100) / 100;

        const products = await Product.find({
            superAdminId: hierarchy.superAdminId
        }).lean();



        const barcodes = await Barcode.find({
            superAdminId: hierarchy.superAdminId
        }).lean();


        let totalCostValue = 0;
        let totalSellingValue = 0;
        let totalMrpValue = 0;

        const data = [];



        const barcodeMap = new Map();

        for (const barcode of barcodes) {
            const productId = String(barcode.productId);

            if (!barcodeMap.has(productId)) {
                barcodeMap.set(productId, []);
            }

            barcodeMap.get(productId).push(barcode);
        }



        for (const product of products) {

            const productId = String(product._id);

            const productBarcodes =
                barcodeMap.get(productId) || [];



            if (productBarcodes.length > 0) {

                for (const barcode of productBarcodes) {

                    const currentStock = Number(
                        Number(product.stock || 0).toFixed(2)
                    );

                    const mrp = Number(product.mrp || 0);
                    const costPrice = Number(product.costPrice || 0);
                    const sellingPrice = Number(product.sellingPrice || 0);

                    const costValue = round2(currentStock * costPrice);
                    const sellingValue = round2(currentStock * sellingPrice);
                    const mrpValue = round2(currentStock * mrp);

                    totalCostValue += costValue;
                    totalSellingValue += sellingValue;
                    totalMrpValue += mrpValue;

                    data.push({
                        productId: product._id,
                        productName: product.name || "",
                        itemCode: product.itemCode || "",

                        barcode: barcode.code || "",

                        currentStock,
                        productStock: currentStock,

                        mrp,
                        costPrice,
                        sellingPrice,

                        costValue,
                        sellingValue,
                        mrpValue,

                        unit: barcode.unit || product.unit || "pcs",
                        unitValue: barcode.unitValue || product.unitValue || 1,

                        gstRate: product.gstRate ?? "none",

                        status:
                            currentStock <= 0
                                ? "Out Of Stock"
                                : currentStock <= Number(product.lowStockQty ?? 10)
                                    ? "Low Stock"
                                    : "Available"
                    });
                }
            }

            else {

                const currentStock = Number(
                    Number(product.stock || 0).toFixed(2)
                );

                const mrp = Number(
                    product.mrp || 0
                );

                const costPrice = Number(
                    product.costPrice || 0
                );

                const sellingPrice = Number(
                    product.sellingPrice || 0
                );

                const costValue = round2(
                    currentStock * costPrice
                );

                const sellingValue = round2(
                    currentStock * sellingPrice
                );

                const mrpValue = round2(
                    currentStock * mrp
                );

                totalCostValue += costValue;
                totalSellingValue += sellingValue;
                totalMrpValue += mrpValue;

                data.push({

                    productId: product._id,

                    productName:
                        product.name || "",

                    itemCode:
                        product.itemCode || "",

                    barcode: null,

                    currentStock,

                    productStock:
                        currentStock,



                    mrp,

                    costPrice,

                    sellingPrice,

                    costValue,

                    sellingValue,

                    mrpValue,

                    unit:
                        product.unit || "pcs",

                    unitValue:
                        Number(product.unitValue || 1),

                    gstRate:
                        Number(product.gstRate || 0),

                    status:
                        currentStock <= 0
                            ? "Out Of Stock"
                            : currentStock <= Number(product.lowStockQty ?? 10)
                                ? "Low Stock"
                                : "Available"
                });
            }
        }




        data.sort((a, b) => {
            return String(b.productId).localeCompare(
                String(a.productId)
            );
        });

        return res.status(200).json({
            success: true,

            count: data.length,

            summary: {
                totalCostValue:
                    round2(totalCostValue),

                totalSellingValue:
                    round2(totalSellingValue),

                totalMrpValue:
                    round2(totalMrpValue),

                expectedProfit:
                    round2(
                        totalSellingValue -
                        totalCostValue
                    )
            },

            data
        });

    } catch (err) {

        console.error(
            "getStockValue error:",
            err
        );

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};


exports.getproductsearchstock = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);
        const { search } = req.query;

        if (!search || search.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Search is required"
            });
        }

        const searchText = search.trim();

        const products = await Product.find({
            superAdminId: hierarchy.superAdminId,
            $or: [
                {
                    name: {
                        $regex: searchText,
                        $options: "i"
                    }
                },
                {
                    itemCode: {
                        $regex: searchText,
                        $options: "i"
                    }
                }
            ]
        }).lean();


        const productIds = products.map(
            product => product._id
        );

        const barcodes = await Barcode.find({
            superAdminId: hierarchy.superAdminId,
            $or: [
                { productId: { $in: productIds } },
                { code: { $regex: searchText, $options: "i" } }
            ]
        })
            .populate(
                "productId",
                "name itemCode stock unit unitValue mrp costPrice sellingPrice gstRate lowStockQty"
            )

            .sort({ createdAt: -1 })
            .lean();

        const data = [];

        const barcodeMap = new Map();


        for (const barcode of barcodes) {

            if (!barcode.productId) continue;

            const productId =
                String(barcode.productId._id);

            if (!barcodeMap.has(productId)) {
                barcodeMap.set(productId, []);
            }

            barcodeMap.get(productId).push(barcode);
        }



        for (const product of products) {

            const productId =
                String(product._id);

            const productBarcodes =
                barcodeMap.get(productId) || [];



            if (productBarcodes.length > 0) {

                for (const barcode of productBarcodes) {

                    const currentStock = Number(
                        Number(product.stock || 0).toFixed(2)
                    );


                    const costPrice = Number(product.costPrice || 0);
                    const stockValue = Number((currentStock * costPrice).toFixed(2));

                    data.push({
                        productId: product._id,
                        itemCode: product.itemCode || "",
                        productName: product.name || "",


                        barcode: barcode.code,

                        currentStock,
                        productStock: currentStock,
                        soldQty: 0,

                        mrp: product.mrp || 0,

                        costPrice,
                        stockValue,

                        sellingPrice: product.sellingPrice || 0,

                        gstRate: product.gstRate ?? "none",


                        unit: barcode.unit || product.unit || "pcs",
                        unitValue: barcode.unitValue || product.unitValue || 1,

                        displayName: `${barcode.unitValue || product.unitValue || 1} ${barcode.unit || product.unit || "pcs"} ${product.name}`,

                        status:
                            currentStock <= 0
                                ? "Out Of Stock"
                                : currentStock <= Number(product.lowStockQty ?? 10)
                                    ? "Low Stock"
                                    : "Available"
                    });
                }
            }

            else {

                const currentStock = Number(
                    Number(product.stock || 0).toFixed(2)
                );

                const costPrice = Number(
                    product.costPrice || 0
                );

                const sellingPrice = Number(
                    product.sellingPrice || 0
                );

                const mrp = Number(
                    product.mrp || 0
                );

                const gstRate = product.gstRate ?? "none";


                const unit =
                    product.unit || "pcs";

                const unitValue = Number(
                    product.unitValue || 1
                );

                const stockValue = Number(
                    (
                        currentStock *
                        costPrice
                    ).toFixed(2)
                );

                data.push({

                    productId:
                        product._id,

                    itemCode:
                        product.itemCode || "",

                    productName:
                        product.name || "",

                    barcode: null,

                    currentStock,

                    productStock:
                        currentStock,



                    soldQty: 0,

                    mrp,

                    costPrice,

                    stockValue,

                    sellingPrice,

                    gstRate,

                    unit,

                    unitValue,

                    displayName:
                        `${unitValue} ${unit} ${product.name}`,

                    status:
                        currentStock <= 0
                            ? "Out Of Stock"
                            : currentStock <= Number(product.lowStockQty ?? 10)
                                ? "Low Stock"
                                : "Available"
                });
            }
        }



        const existingBarcodeIds = new Set(
            data
                .filter(item => item.barcode)
                .map(item => String(item.barcode))
        );

        for (const barcode of barcodes) {

            if (!barcode.productId) continue;

            if (
                !barcode.code
                    .toLowerCase()
                    .includes(
                        searchText.toLowerCase()
                    )
            ) {
                continue;
            }

            if (
                existingBarcodeIds.has(
                    String(barcode.code)
                )
            ) {
                continue;
            }

            const product =
                barcode.productId;

            const currentStock = Number(
                Number(product.stock || 0).toFixed(2)
            );

            const costPrice = Number(product.costPrice || 0);

            const sellingPrice = Number(product.sellingPrice || 0);

            const mrp = Number(product.mrp || 0);

            const gstRate = product.gstRate ?? "none";

            const unit =
                barcode.unit ||
                product.unit ||
                "pcs";

            const unitValue = Number(
                barcode.unitValue ??
                product.unitValue ??
                1
            );

            const stockValue = Number(
                (
                    currentStock *
                    costPrice
                ).toFixed(2)
            );

            const soldQty = 0;

            data.push({

                productId:
                    product._id,

                itemCode:
                    product.itemCode || "",

                productName:
                    product.name || "",

                barcode:
                    barcode.code,

                currentStock,

                productStock: currentStock,

                soldQty,

                mrp,

                costPrice,

                stockValue,

                sellingPrice,

                gstRate,

                unit,

                unitValue,

                displayName:
                    `${unitValue} ${unit} ${product.name}`,

                status:
                    currentStock <= 0
                        ? "Out Of Stock"
                        : currentStock <= Number(product.lowStockQty ?? 10)
                            ? "Low Stock"
                            : "Available"
            });

            existingBarcodeIds.add(
                String(barcode.code)
            );
        }


        data.sort((a, b) => {
            return String(b.productId).localeCompare(
                String(a.productId)
            );
        });

        return res.status(200).json({
            success: true,
            count: data.length,
            data
        });

    } catch (err) {

        console.error(
            "getproductsearchstock error:",
            err
        );

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

exports.productStockById = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);
        const { productId } = req.params;

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "Product id is required"
            });
        }

        const product = await Product.findOne({
            _id: productId,
            superAdminId: hierarchy.superAdminId
        }).lean();

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        const barcodes = await Barcode.find({
            productId,
            superAdminId: hierarchy.superAdminId
        })
            .select(
                "code unit unitValue createdAt"
            )
            .sort({ createdAt: -1 })
            .lean();

        const data = [];

        const formatQty = (value) => {
            const num = Number(value || 0);

            return Number.isInteger(num)
                ? String(num)
                : String(Number(num.toFixed(2)));
        };



        const currentStock = Number(
            Number(product.stock || 0).toFixed(2)
        );

        const unit = product.unit || "pcs";

        const unitValue = Number(
            product.unitValue ?? 1
        );

        const safeUnitValue =
            unitValue > 0 ? unitValue : 1;

        const costPrice = Number(product.costPrice || 0);

        const sellingPrice = Number(product.sellingPrice || 0);


        let productTotalStockText = "";

        if (unit === "kg") {
            productTotalStockText =
                `${formatQty(currentStock)} kg`;

        } else if (unit === "g") {
            productTotalStockText =
                `${formatQty(currentStock / 1000)} kg`;

        } else {
            productTotalStockText =
                `${formatQty(currentStock)} pcs`;
        }


        let totalCostValue = 0;
        let totalSellingValue = 0;

        if (unit === "kg") {
            totalCostValue =
                currentStock * costPrice;

            totalSellingValue =
                currentStock * sellingPrice;

        } else if (unit === "g") {
            totalCostValue =
                (currentStock / 1000) * costPrice;

            totalSellingValue =
                (currentStock / 1000) * sellingPrice;

        } else {
            totalCostValue =
                currentStock * costPrice;

            totalSellingValue =
                currentStock * sellingPrice;
        }

        totalCostValue = Number(
            totalCostValue.toFixed(2)
        );

        totalSellingValue = Number(
            totalSellingValue.toFixed(2)
        );


        for (const barcode of barcodes) {

            const barcodeUnit =
                barcode.unit || unit;

            const barcodeUnitValue = Number(
                barcode.unitValue ?? unitValue
            );

            const costPrice = Number(product.costPrice || 0);

            const sellingPrice = Number(product.sellingPrice || 0);

            let totalStockText = "";

            if (barcodeUnit === "kg") {

                totalStockText =
                    `${formatQty(currentStock)} kg`;

            } else if (barcodeUnit === "g") {

                totalStockText =
                    `${formatQty(currentStock / 1000)} kg`;

            } else {

                totalStockText =
                    `${formatQty(currentStock)} pcs`;
            }



            data.push({
                productId: product._id,

                productName:
                    product.name || "",

                itemCode:
                    product.itemCode || "",

                barcode:
                    barcode.code || null,


                totalQty: currentStock,

                currentStock,


                soldQty: 0,

                actualStockQty:
                    currentStock,

                stockValue: Number(
                    (
                        unit === "g"
                            ? (currentStock / 1000) * costPrice
                            : currentStock * costPrice
                    ).toFixed(2)
                ),

                totalStockText,

                mrp: Number(product.mrp || 0),

                costPrice,

                sellingPrice,

                gstRate: product.gstRate ?? "none",

                unit: barcodeUnit,

                unitValue: barcodeUnitValue,

                unitText:
                    `${barcodeUnitValue} ${barcodeUnit}`,

                status:
                    currentStock <= 0
                        ? "Out Of Stock"
                        : currentStock <= Number(
                            product.lowStockQty ?? 10
                        )
                            ? "Low Stock"
                            : "Available"
            });
        }


        if (barcodes.length === 0) {

            const gstRate =
                product.gstRate !== undefined &&
                    product.gstRate !== null &&
                    product.gstRate !== ""
                    ? product.gstRate
                    : "none";

            data.push({
                productId: product._id,

                productName:
                    product.name || "",

                itemCode:
                    product.itemCode || "",

                barcode: null,

                totalQty:
                    currentStock,

                currentStock,

                soldQty: 0,

                actualStockQty:
                    currentStock,

                stockValue:
                    totalCostValue,

                totalStockText:
                    productTotalStockText,

                mrp:
                    product.mrp || 0,

                costPrice,

                sellingPrice,

                gstRate,

                unit,

                unitValue,

                unitText:
                    `${safeUnitValue} ${unit}`,

                status:
                    currentStock <= 0
                        ? "Out Of Stock"
                        : currentStock <= Number(
                            product.lowStockQty ?? 10)
                            ? "Low Stock"
                            : "Available"
            });
        }


        let status = "Available";

        if (currentStock <= 0) {
            status = "Out Of Stock";
        } else if (
            currentStock <= Number(
                product.lowStockQty ?? 10
            )
        ) {
            status = "Low Stock";
        }


        return res.status(200).json({
            success: true,

            product: {
                productId: product._id,

                productName:
                    product.name || "",

                itemCode:
                    product.itemCode || "",

                unit:
                    product.unit || "pcs",

                unitValue:
                    product.unitValue || 1,

                currentStock,

                totalStock:
                    productTotalStockText,

                gstRate:
                    product.gstRate !== undefined &&
                        product.gstRate !== null &&
                        product.gstRate !== ""
                        ? product.gstRate
                        : "none",

                status
            },

            summary: {

                totalQty: currentStock,

                currentStock,


                soldQty: 0,

                totalCostValue,

                totalSellingValue,

                expectedProfit: Number(
                    (
                        totalSellingValue -
                        totalCostValue
                    ).toFixed(2)
                )
            },

            count: data.length,

            data
        });

    } catch (err) {
        console.error(
            "productStockById error:",
            err
        );

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};


exports.getTopSellingProducts = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);


        const result = await Bill.aggregate([
            {
                $match: {
                    superAdminId: hierarchy.superAdminId
                }
            },
            { $unwind: "$items" },
            {
                $group: {
                    productId: "$_id",
                    productNameFromBill: { $first: "$items.productName" },
                    nameFromBill: { $first: "$items.name" },

                    totalQtySold: { $sum: "$items.qty" },
                    totalSalesAmount: { $sum: "$items.finalPrice" },
                    totalGST: { $sum: "$items.gstAmount" }
                }
            },
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "product"
                }
            },
            {

                $unwind: "$product"
            },

            {
                $lookup: {
                    from: "barcodes",
                    let: {
                        productId: "$_id",

                        superAdminId: hierarchy.superAdminId
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$productId", "$$productId"] },
                                        { $eq: ["$superAdminId", "$$superAdminId"] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "barcodeData"
                }
            },

            {
                $sort: {
                    totalQtySold: -1
                }
            },
            {
                $project: {
                    _id: 0,
                    productId: "$_id.productId",

                    itemCode: {
                        $ifNull: ["$product.itemCode", ""]
                    },

                    productName: {
                        $ifNull: [
                            "$productNameFromBill",
                            {
                                $ifNull: [
                                    "$nameFromBill",
                                    "$product.name"
                                ]
                            }
                        ]
                    },

                    barcodes: "$barcodeData",

                    gstRate: {
                        $ifNull: [
                            "$product.gstRate",
                            "none"
                        ]
                    },

                    currentStock: {
                        $ifNull: ["$product.stock", 0]
                    },

                    productStock: {
                        $ifNull: ["$product.stock", 0]
                    },

                    unit: {
                        $ifNull: ["$product.unit", "pcs"]
                    },

                    unitValue: {
                        $ifNull: ["$product.unitValue", 1]
                    },

                    totalQtySold: 1,
                    totalSalesAmount: { $round: ["$totalSalesAmount", 2] },
                    totalGST: { $round: ["$totalGST", 2] }
                }
            }
        ]);

        return res.status(200).json({
            success: true,
            message: "Top selling products fetched successfully",
            data: result
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};


exports.lowstockcheck = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const products = await Product.find({
            superAdminId: hierarchy.superAdminId
        }).lean();



        const barcodes = await Barcode.find({
            superAdminId: hierarchy.superAdminId
        }).lean();

        let totalLowStockQty = 0;
        let totalStockValue = 0;

        const data = [];

        const formatQty = (value) => {
            const num = Number(value || 0);
            return Number.isInteger(num)
                ? String(num)
                : String(Number(num.toFixed(2)));
        };

        const barcodeMap = new Map();

        for (const barcode of barcodes) {


            if (!barcode.productId) {
                continue;
            }

            const productId = String(barcode.productId);

            if (!barcodeMap.has(productId)) {
                barcodeMap.set(productId, []);
            }

            barcodeMap.get(productId).push(barcode);
        }



        for (const product of products) {

            const productId =
                String(product._id);

            const productBarcodes =
                barcodeMap.get(productId) || [];

            const lowStockQty = Number(
                product.lowStockQty ?? 10
            );



            if (productBarcodes.length > 0) {

                for (const barcode of productBarcodes) {

                    const qty = Number(
                        Number(product.stock || 0).toFixed(2)
                    );


                    if (
                        qty <= 0 ||
                        qty > lowStockQty
                    ) {
                        continue;
                    }

                    const costPrice = Number(
                        product.costPrice || 0
                    );

                    const mrp = Number(
                        product.mrp || 0
                    );

                    const sellingPrice = Number(
                        product.sellingPrice || 0
                    );

                    const stockValue = Number(
                        (
                            qty *
                            costPrice
                        ).toFixed(2)
                    );

                    const unit =
                        barcode.unit ||
                        product.unit ||
                        "pcs";

                    const unitValue = Number(
                        barcode.unitValue ??
                        product.unitValue ??
                        1
                    );

                    let totalUnitText = "";

                    if (unit === "kg") {

                        totalUnitText =
                            `${formatQty(
                                qty * unitValue
                            )} kg`;

                    } else if (unit === "g") {

                        totalUnitText =
                            `${formatQty(
                                (qty * unitValue) / 1000
                            )} kg`;

                    } else {

                        totalUnitText =
                            `${formatQty(qty)} pcs`;
                    }

                    totalLowStockQty += qty;
                    totalStockValue += stockValue;

                    data.push({
                        productId: product._id,

                        productName: product.name || "",

                        itemCode: product.itemCode || "",

                        barcode: barcode.code || "",

                        currentStock: qty,
                        lowStockQty,

                        totalProductStock: Number(product.stock || 0),

                        gstRate: product.gstRate ?? "none",

                        unit,
                        unitValue,
                        totalUnitText,

                        mrp,
                        costPrice,
                        sellingPrice,

                        stockValue: Number(stockValue.toFixed(2)),

                        status: "Low Stock"
                    });
                }
            }



            else {

                const qty = Number(
                    Number(
                        product.stock || 0
                    ).toFixed(2)
                );


                if (
                    qty <= 0 ||
                    qty > lowStockQty
                ) {
                    continue;
                }

                const costPrice = Number(
                    product.costPrice || 0
                );

                const mrp = Number(
                    product.mrp || 0
                );

                const sellingPrice = Number(
                    product.sellingPrice || 0
                );

                const stockValue = Number(
                    (
                        qty *
                        costPrice
                    ).toFixed(2)
                );

                const unit =
                    product.unit || "pcs";

                const unitValue = Number(
                    product.unitValue || 1
                );

                let totalUnitText = "";

                if (unit === "kg") {

                    totalUnitText =
                        `${formatQty(
                            qty * unitValue
                        )} kg`;

                } else if (unit === "g") {

                    totalUnitText =
                        `${formatQty(
                            (qty * unitValue) / 1000
                        )} kg`;

                } else {

                    totalUnitText =
                        `${formatQty(qty)} pcs`;
                }

                if (barcode === productBarcodes[0]) {
                    totalLowStockQty += qty;
                    totalStockValue += stockValue;
                }

                data.push({

                    productId:
                        product._id,

                    productName:
                        product.name || "",

                    itemCode:
                        product.itemCode || "",

                    barcode: null,

                    currentStock:
                        qty,

                    lowStockQty,

                    totalProductStock:
                        qty,

                    unit,

                    unitValue,

                    totalUnitText,

                    mrp,

                    costPrice,

                    sellingPrice,

                    stockValue,

                    gstRate: product.gstRate ?? "none",

                    status:
                        "Low Stock"
                });
            }
        }




        data.sort((a, b) => {
            return (
                Number(a.currentStock) -
                Number(b.currentStock)
            );
        });



        data.forEach((item, index) => {
            item.sno = index + 1;
        });

        return res.status(200).json({

            success: true,

            summary: {
                totalLowStockProducts:
                    data.length,

                totalLowStockQty:
                    Number(
                        totalLowStockQty.toFixed(2)
                    ),

                totalStockValue:
                    Number(
                        totalStockValue.toFixed(2)
                    )
            },

            count: data.length,

            data
        });

    } catch (err) {

        console.error(
            "lowstockcheck error:",
            err
        );

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};


exports.outofstockcheck = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);



        const products = await Product.find({
            superAdminId: hierarchy.superAdminId
        }).lean();



        const barcodes = await Barcode.find({
            superAdminId: hierarchy.superAdminId
        }).lean();

        const data = [];

        const formatQty = (value) => {
            const num = Number(value || 0);

            return Number.isInteger(num)
                ? String(num)
                : String(Number(num.toFixed(2)));
        };



        const barcodeMap = new Map();

        for (const barcode of barcodes) {

            if (!barcode.productId) {
                continue;
            }

            const productId = String(barcode.productId);

            if (!barcodeMap.has(productId)) {
                barcodeMap.set(productId, []);
            }

            barcodeMap.get(productId).push(barcode);
        }



        for (const product of products) {

            const productId =
                String(product._id);

            const productBarcodes =
                barcodeMap.get(productId) || [];


            if (productBarcodes.length > 0) {

                for (const barcode of productBarcodes) {

                    const qty = Number(
                        Number(product.stock || 0).toFixed(2)
                    );


                    if (qty > 0) {
                        continue;
                    }

                    const unit = product.unit || "pcs";

                    const unitValue = Number(
                        product.unitValue ?? 1
                    );

                    let totalUnitText = "";

                    if (unit === "kg") {

                        totalUnitText =
                            `${formatQty(
                                qty * unitValue
                            )} kg`;

                    } else if (unit === "g") {

                        totalUnitText =
                            `${formatQty(
                                (qty * unitValue) / 1000
                            )} kg`;

                    } else {

                        totalUnitText =
                            `${formatQty(qty)} pcs`;
                    }

                    data.push({

                        productId:
                            product._id,

                        productName:
                            product.name || "",

                        itemCode:
                            product.itemCode || "",

                        barcode:
                            barcode.code || "",

                        currentStock:
                            qty,

                        totalProductStock:
                            Number(
                                product.stock || 0
                            ),

                        unit,

                        unitValue,

                        totalUnitText,

                        mrp: Number(product.mrp || 0),

                        costPrice: Number(product.costPrice || 0),

                        sellingPrice: Number(product.sellingPrice || 0),

                        gstRate: product.gstRate ?? "none",


                        status:
                            "Out Of Stock"
                    });
                }
            }



            else {

                const qty = Number(
                    Number(
                        product.stock || 0
                    ).toFixed(2)
                );


                if (qty > 0) {
                    continue;
                }

                const unit =
                    product.unit || "pcs";

                const unitValue = Number(
                    product.unitValue || 1
                );

                let totalUnitText = "";

                if (unit === "kg") {

                    totalUnitText =
                        `${formatQty(
                            qty * unitValue
                        )} kg`;

                } else if (unit === "g") {

                    totalUnitText =
                        `${formatQty(
                            (qty * unitValue) / 1000
                        )} kg`;

                } else {

                    totalUnitText =
                        `${formatQty(qty)} pcs`;
                }

                data.push({

                    productId:
                        product._id,

                    productName:
                        product.name || "",

                    itemCode:
                        product.itemCode || "",


                    barcode: null,

                    currentStock:
                        qty,

                    totalProductStock:
                        qty,

                    unit,

                    unitValue,

                    totalUnitText,

                    mrp:
                        Number(
                            product.mrp || 0
                        ),

                    costPrice:
                        Number(
                            product.costPrice || 0
                        ),

                    sellingPrice:
                        Number(
                            product.sellingPrice || 0
                        ),

                    gstRate:
                        product.gstRate !== undefined &&
                            product.gstRate !== null &&
                            product.gstRate !== ""
                            ? product.gstRate
                            : 0,

                    status:
                        "Out Of Stock"
                });
            }
        }



        data.sort((a, b) => {
            return String(b.productId).localeCompare(
                String(a.productId)
            );
        });



        data.forEach((item, index) => {
            item.sno = index + 1;
        });

        return res.status(200).json({

            success: true,

            summary: {
                totalOutOfStockProducts:
                    data.length
            },

            count:
                data.length,

            data
        });

    } catch (err) {

        console.error(
            "outofstockcheck error:",
            err
        );

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};