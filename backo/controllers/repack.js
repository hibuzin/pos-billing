const mongoose = require("mongoose");
const Product = require("../models/product");
const Barcode = require("../models/barcode");
const Repack = require("../models/repack");
const { attachHierarchy } = require("../utils/hierarchy");

const convertToKg = (unit, unitValue, qty) => {
    const finalUnit = String(unit || "").trim().toLowerCase();
    const finalUnitValue = Number(unitValue || 1);
    const finalQty = Number(qty || 0);

    if (finalUnit === "kg") {
        return finalQty * finalUnitValue;
    }


    if (finalUnit === "g" || finalUnit === "gram" || finalUnit === "grams") {
        return (finalQty * finalUnitValue) / 1000;
    }

    throw new Error("Only kg and g units are allowed in repack");
};


exports.createRepack = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const { fromProductId, outputs } = req.body;

        if (!fromProductId) {
            await session.abortTransaction();
            session.endSession();

            return res.status(400).json({
                success: false,
                message: "From product required"
            });
        }

        if (!Array.isArray(outputs) || outputs.length === 0) {
            await session.abortTransaction();
            session.endSession();

            return res.status(400).json({
                success: false,
                message: "Outputs are required"
            });
        }

        const hierarchy = attachHierarchy(req.user);

        const fromProduct = await Product.findOne({
            _id: fromProductId,
            superAdminId: hierarchy.superAdminId
        }).session(session);

        if (!fromProduct) {
            throw new Error("From product not found");
        }

        if (fromProduct.productType !== "bulk") {
            throw new Error("From product must be bulk product");
        }

        const fromUnitValue = Number(fromProduct.unitValue || 1);
        const fromUnit = String(fromProduct.unit || "").trim().toLowerCase();

        if (!["kg", "g", "gram", "grams"].includes(fromUnit)) {
            throw new Error("From product must be kg or g unit");
        }

        const fromBarcodeData = await Barcode.findOne({
            productId: fromProductId,
            superAdminId: hierarchy.superAdminId,
            availableQty: { $gt: 0 }
        }).session(session);

        if (!fromBarcodeData) {
            throw new Error("Available barcode not found for from product");
        }

        const fromBarcode = fromBarcodeData.code;

        const finalOutputs = [];

        for (const item of outputs) {
            const toProduct = await Product.findOne({
                _id: item.toProductId,
                superAdminId: hierarchy.superAdminId
            }).session(session);

            if (!toProduct) {
                throw new Error("Output product not found");
            }

            if (toProduct.productType !== "repack") {
                throw new Error("Output product must be repack product");
            }

            if (
                toProduct.parentProductId &&
                String(toProduct.parentProductId) !== String(fromProductId)
            ) {
                throw new Error("Output repack product parent does not match from bulk product");
            }

            const toQty = Number(item.toQty);

            if (isNaN(toQty) || toQty <= 0) {
                throw new Error("Valid output qty is required");
            }

            let finalToBarcode = item.toBarcode
                ? String(item.toBarcode).trim()
                : "";

            if (!finalToBarcode) {
                const existingToBarcode = await Barcode.findOne({
                    productId: item.toProductId,
                    superAdminId: hierarchy.superAdminId
                }).session(session);

                if (existingToBarcode) {
                    finalToBarcode = existingToBarcode.code;
                }
            }

            if (!finalToBarcode) {
                throw new Error(`Barcode not found for output product: ${toProduct.name}`);
            }

            finalOutputs.push({
                ...item,
                toBarcode: finalToBarcode,
                product: toProduct
            });
        }

        let totalOutputKg = 0;

        for (const item of finalOutputs) {
            totalOutputKg += convertToKg(
                item.product.unit,
                item.product.unitValue,
                item.toQty
            );
        }

        if (totalOutputKg <= 0) {
            throw new Error("Valid output kg is required");
        }

        let deductQty = 0;

        if (fromUnit === "kg") {
            deductQty = totalOutputKg / fromUnitValue;
        }

        if (fromUnit === "g" || fromUnit === "gram" || fromUnit === "grams") {
            deductQty = (totalOutputKg * 1000) / fromUnitValue;
        }

        if (Number(fromProduct.stock || 0) < deductQty) {
            throw new Error("Not enough product stock");
        }

        if (Number(fromBarcodeData.availableQty || 0) < deductQty) {
            throw new Error("Not enough barcode stock");
        }

        await Product.updateOne(
            {
                _id: fromProductId,
                superAdminId: hierarchy.superAdminId
            },
            {
                $inc: {
                    stock: -deductQty
                }
            },
            { session }
        );

        await Barcode.updateOne(
            {
                _id: fromBarcodeData._id,
                superAdminId: hierarchy.superAdminId
            },
            {
                $inc: {
                    availableQty: -deductQty
                }
            },
            { session }
        );

        for (const item of finalOutputs) {
            const toProduct = item.product;

            await Product.updateOne(
                {
                    _id: item.toProductId,
                    superAdminId: hierarchy.superAdminId
                },
                {
                    $inc: {
                        stock: Number(item.toQty)
                    }
                },
                { session }
            );

            await Barcode.findOneAndUpdate(
                {
                    productId: item.toProductId,
                    code: String(item.toBarcode).trim(),
                    superAdminId: hierarchy.superAdminId
                },
                {
                    $set: {
                        productId: item.toProductId,
                        code: String(item.toBarcode).trim(),

                        mrp: Number(toProduct.mrp || 0),
                        sellingPrice: Number(toProduct.sellingPrice || 0),
                        costPrice: Number(toProduct.costPrice || 0),
                        gstRate: Number(toProduct.gstRate || 0),

                        unit: toProduct.unit,
                        unitValue: Number(toProduct.unitValue || 1),

                        isSold: false,

                        ...hierarchy,
                        createdBy: req.user.userId
                    },
                    $inc: {
                        qty: Number(item.toQty),
                        availableQty: Number(item.toQty)
                    }
                },
                {
                    upsert: true,
                    new: true,
                    session
                }
            );
        }

        const repack = await Repack.create(
            [
                {
                    repackNo: `REP-${Date.now()}`,

                    fromProductId,
                    fromBarcode: String(fromBarcode).trim(),

                    inputKg: totalOutputKg,
                    deductQty,

                    fromUnit: fromProduct.unit,
                    fromUnitValue,

                    outputs: finalOutputs.map((item) => ({
                        toProductId: item.toProductId,
                        toBarcode: String(item.toBarcode).trim(),
                        toQty: Number(item.toQty),
                        toUnit: item.product.unit,
                        toUnitValue: Number(item.product.unitValue || 1)
                    })),

                    ...hierarchy,
                    createdBy: req.user.userId
                }
            ],
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        return res.status(201).json({
            success: true,
            message: "Repack created successfully",
            data: repack[0]
        });

    } catch (err) {
        await session.abortTransaction();
        session.endSession();

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};


exports.searchRepackProducts = async (req, res) => {
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

        const barcodes = await Barcode.find({
            superAdminId: hierarchy.superAdminId
        })
            .populate({
                path: "productId",
                match: {
                    superAdminId: hierarchy.superAdminId,
                    productType: "repack"
                },
                select: "name brand itemCode stock unit unitValue mrp sellingPrice"
            })
            .sort({ createdAt: -1 });

        const data = [];

        for (const barcode of barcodes) {
            const product = barcode.productId;

            if (!product) continue;

            const match =
                product.name?.toLowerCase().includes(searchText.toLowerCase()) ||
                product.itemCode?.toLowerCase().includes(searchText.toLowerCase()) ||
                barcode.code?.toLowerCase().includes(searchText.toLowerCase());

            if (!match) continue;

            data.push({
                productId: product._id,
                productName: product.name || "",
                brand: product.brand || "",
                itemCode: product.itemCode || "",

                barcode: barcode.code,

                stock: Number(barcode.availableQty || 0),

                unit: barcode.unit || product.unit,
                unitValue: barcode.unitValue || product.unitValue,

                mrp: barcode.mrp || product.mrp,
                sellingPrice: barcode.sellingPrice || product.sellingPrice,

                status:
                    Number(barcode.availableQty || 0) <= 0
                        ? "Out Of Stock"
                        : Number(barcode.availableQty || 0) <= 10
                            ? "Low Stock"
                            : "Available"
            });
        }

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


exports.getRepackProductsByBulk = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);
        const { bulkProductId } = req.params;

        const bulkProduct = await Product.findOne({
            _id: bulkProductId,
            productType: "bulk",
            superAdminId: hierarchy.superAdminId
        });

        if (!bulkProduct) {
            return res.status(404).json({
                success: false,
                message: "Bulk product not found"
            });
        }

        const repackProducts = await Product.find({
            parentProductId: bulkProductId,
            productType: "repack",
            superAdminId: hierarchy.superAdminId
        })
            .populate("categoryId", "name")
            .populate("parentProductId", "name productType unit unitValue stock")
            .sort({ unitValue: 1 });

        return res.status(200).json({
            success: true,
            message: "Repack products fetched successfully",
            bulkProduct: {
                _id: bulkProduct._id,
                name: bulkProduct.name,
                unit: bulkProduct.unit,
                unitValue: bulkProduct.unitValue,
                stock: bulkProduct.stock
            },
            count: repackProducts.length,
            data: repackProducts
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};


exports.getRepacks = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const repacks = await Repack.find({
            superAdminId: hierarchy.superAdminId
        })
            .populate("fromProductId", "name brand unit unitValue")
            .populate("outputs.toProductId", "name brand unit unitValue")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Repacks fetched successfully",
            count: repacks.length,
            data: repacks
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

exports.getRepackById = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid repack id"
            });
        }

        const repack = await Repack.findOne({
            _id: id,
            superAdminId: hierarchy.superAdminId
        })
            .populate("fromProductId", "name brand unit unitValue")
            .populate("outputs.toProductId", "name brand unit unitValue");

        if (!repack) {
            return res.status(404).json({
                success: false,
                message: "Repack not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Repack fetched successfully",
            data: repack
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};