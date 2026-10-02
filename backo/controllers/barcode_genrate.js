const mongoose = require("mongoose");
const Barcode = require("../models/barcode");
const Product = require("../models/product");
const Counter = require("../models/counter");
const ComboOffer = require("../models/combo_offer");
const { attachHierarchy } = require("../utils/hierarchy");

const generateUniqueBarcode = async (superAdminId) => {
    const counter = await Counter.findOneAndUpdate(
        {
            name: "barcode",
            superAdminId
        },
        {
            $inc: { seq: 1 }
        },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        }
    );

    return `B${String(counter.seq).padStart(8, "0")}`;
};


exports.generateBarcode = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const {
            productId,
            comboOfferId,
            printQty = 1,
            barcode
        } = req.body;


        if (!productId && !comboOfferId) {
            return res.status(400).json({
                success: false,
                message: "Product ID or Combo Offer ID is required"
            });
        }

        if (productId && comboOfferId) {
            return res.status(400).json({
                success: false,
                message: "Provide either productId or comboOfferId"
            });
        }

        if (!Number.isInteger(printQty) || printQty < 1) {
            return res.status(400).json({
                success: false,
                message: "printQty must be greater than 0"
            });
        }

        // =====================================================
        // 2. VARIABLES
        // =====================================================

        let product = null;
        let comboOffer = null;
        let existingBarcode = null;

        // =====================================================
        // 3. PRODUCT
        // =====================================================

        if (productId) {

            if (!mongoose.Types.ObjectId.isValid(productId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid productId"
                });
            }

            product = await Product.findOne({
                _id: productId,
                superAdminId: hierarchy.superAdminId
            });

            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found"
                });
            }

            existingBarcode = await Barcode.findOne({
                productId: product._id,
                superAdminId: hierarchy.superAdminId
            });

            // =================================================
            // PRODUCT ALREADY HAS BARCODE
            // =================================================

            if (existingBarcode) {

                if (
                    barcode &&
                    String(barcode).trim() !== existingBarcode.code
                ) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "This product already has a barcode. You cannot assign another barcode."
                    });
                }

                existingBarcode.printQty =
                    (existingBarcode.printQty || 0) + printQty;

                await existingBarcode.save();

                return res.status(200).json({
                    success: true,
                    message:
                        "Product already has a barcode. Print quantity updated.",
                    data: {
                        id: existingBarcode._id,
                        code: existingBarcode.code,
                        productId: existingBarcode.productId,
                        comboOfferId: existingBarcode.comboOfferId || null,

                        mrp: existingBarcode.mrp,
                        costPrice: existingBarcode.costPrice,
                        sellingPrice: existingBarcode.sellingPrice,
                        gstRate: existingBarcode.gstRate,

                        unit: existingBarcode.unit,
                        unitValue: existingBarcode.unitValue,

                        qty: existingBarcode.qty,
                        availableQty: existingBarcode.availableQty,

                        printQty: existingBarcode.printQty,
                        isSold: existingBarcode.isSold
                    }
                });
            }
        }

        // =====================================================
        // 4. COMBO OFFER
        // =====================================================

        if (comboOfferId) {

            if (!mongoose.Types.ObjectId.isValid(comboOfferId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid comboOfferId"
                });
            }

            comboOffer = await ComboOffer.findOne({
                _id: comboOfferId,
                superAdminId: hierarchy.superAdminId
            });

            if (!comboOffer) {
                return res.status(404).json({
                    success: false,
                    message: "Combo offer not found"
                });
            }

            existingBarcode = await Barcode.findOne({
                comboOfferId: comboOffer._id,
                superAdminId: hierarchy.superAdminId
            });

            // =================================================
            // COMBO ALREADY HAS BARCODE
            // =================================================

            if (existingBarcode) {

                if (
                    barcode &&
                    String(barcode).trim() !== existingBarcode.code
                ) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "This combo offer already has a barcode. You cannot assign another barcode."
                    });
                }

                existingBarcode.printQty =
                    (existingBarcode.printQty || 0) + printQty;

                await existingBarcode.save();

                return res.status(200).json({
                    success: true,
                    message:
                        "Combo offer already has a barcode. Print quantity updated.",
                    data: {
                        id: existingBarcode._id,
                        code: existingBarcode.code,

                        productId: existingBarcode.productId || null,
                        comboOfferId: existingBarcode.comboOfferId,

                        printQty: existingBarcode.printQty,
                        isSold: existingBarcode.isSold
                    }
                });
            }

            // =================================================
            // COMBO OFFER BARCODE FIELD ALREADY EXISTS
            // =================================================

            if (comboOffer.barcode) {

                if (
                    barcode &&
                    String(barcode).trim() !== comboOffer.barcode
                ) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "This combo offer already has a barcode. You cannot assign another barcode."
                    });
                }

                // Try to find Barcode record using combo barcode
                existingBarcode = await Barcode.findOne({
                    code: comboOffer.barcode,
                    superAdminId: hierarchy.superAdminId
                });

                if (existingBarcode) {

                    existingBarcode.printQty =
                        (existingBarcode.printQty || 0) + printQty;

                    await existingBarcode.save();

                    return res.status(200).json({
                        success: true,
                        message:
                            "Combo offer barcode already exists. Print quantity updated.",
                        data: {
                            id: existingBarcode._id,
                            code: existingBarcode.code,
                            productId:
                                existingBarcode.productId || null,
                            comboOfferId:
                                existingBarcode.comboOfferId || null,
                            printQty: existingBarcode.printQty,
                            isSold: existingBarcode.isSold
                        }
                    });
                }
            }
        }

        // =====================================================
        // 5. BARCODE CODE
        // =====================================================

        let code;

        if (barcode !== undefined && barcode !== null) {

            code = String(barcode).trim();

            if (!code) {
                return res.status(400).json({
                    success: false,
                    message: "Barcode cannot be empty"
                });
            }

            const barcodeExists = await Barcode.findOne({
                code,
                superAdminId: hierarchy.superAdminId
            });

            if (barcodeExists) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Barcode already exists for another product or combo offer"
                });
            }

        } else {

            code = await generateUniqueBarcode(
                hierarchy.superAdminId
            );
        }

        // =====================================================
        // 6. CREATE BARCODE
        // =====================================================

        const barcodeData = {
            code,

            productId: product
                ? product._id
                : null,

            comboOfferId: comboOffer
                ? comboOffer._id
                : null,

            printQty,

            isSold: false,

            superAdminId: hierarchy.superAdminId,
            adminId: hierarchy.adminId,
            createdBy: req.user.userId
        };

        // =====================================================
        // PRODUCT DATA
        // =====================================================

        if (product) {

            barcodeData.mrp = product.mrp || 0;
            barcodeData.costPrice = product.costPrice || 0;
            barcodeData.sellingPrice = product.sellingPrice || 0;

            // IMPORTANT:
            // Preserve "none"
            barcodeData.gstRate =
                product.gstRate !== undefined &&
                product.gstRate !== null
                    ? product.gstRate
                    : 0;

            barcodeData.unit =
                product.unit || "pcs";

            barcodeData.unitValue =
                product.unitValue !== undefined
                    ? product.unitValue
                    : 1;
        }

        const newBarcode = await Barcode.create(barcodeData);

        // =====================================================
        // 7. UPDATE COMBO OFFER
        // =====================================================

        if (comboOffer) {

            comboOffer.barcode = newBarcode.code;

            await comboOffer.save();
        }

        // =====================================================
        // 8. RESPONSE
        // =====================================================

        return res.status(201).json({
            success: true,
            message: comboOffer
                ? "Combo offer barcode generated successfully"
                : "Barcode generated successfully",

            data: {
                id: newBarcode._id,
                code: newBarcode.code,

                productId:
                    newBarcode.productId || null,

                comboOfferId:
                    newBarcode.comboOfferId || null,

                mrp: newBarcode.mrp,
                costPrice: newBarcode.costPrice,
                sellingPrice: newBarcode.sellingPrice,

                gstRate: newBarcode.gstRate,

                unit: newBarcode.unit,
                unitValue: newBarcode.unitValue,

                qty: newBarcode.qty,
                availableQty: newBarcode.availableQty,

                printQty: newBarcode.printQty,
                isSold: newBarcode.isSold
            }
        });

    } catch (error) {

        console.error("Generate Barcode Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while generating barcode",
            error: error.message
        });
    }
};