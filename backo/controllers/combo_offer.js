const ComboOffer = require("../models/combo_offer");
const Product = require("../models/product");
const { attachHierarchy } = require("../utils/hierarchy");
const Barcode = require("../models/barcode");


exports.createComboOffer = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const {
            offerName,
            barcode,
            products,
            comboPrice,
            comboQty,
            startDate,
            endDate,
            isActive
        } = req.body;

        if (!offerName) {
            return res.status(400).json({
                success: false,
                message: "Offer name is required"
            });
        }

        if (barcode) {

            const existingBarcode = await Barcode.findOne({
                code: String(barcode).trim(),
                superAdminId: hierarchy.superAdminId
            });

            if (existingBarcode) {
                return res.status(400).json({
                    success: false,
                    message: "This barcode already exists for another product or combo offer"
                });
            }
        }

        if (!products || !products.length) {
            return res.status(400).json({
                success: false,
                message: "Products are required"
            });
        }

        const requestedComboQty = Number(comboQty);

        if (!requestedComboQty || requestedComboQty <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid comboQty is required"
            });
        }



        for (const item of products) {

            const requiredQty = Number(item.qty || 1);

            if (requiredQty <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Product quantity must be greater than 0"
                });
            }

            const product = await Product.findOne({
                _id: item.productId,
                superAdminId: hierarchy.superAdminId
            });

            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found"
                });
            }

            const requiredStock =
                requiredQty * requestedComboQty;

            const availableStock =
                Number(product.stock || 0) -
                Number(product.reservedStock || 0);

            if (availableStock < requiredStock) {
                return res.status(400).json({
                    success: false,
                    message:
                        `Insufficient stock for ${product.name}. ` +
                        `Required: ${requiredStock}, Available: ${availableStock}`
                });
            }
        }



        for (const item of products) {

            const requiredQty = Number(item.qty || 1);

            const requiredStock =
                requiredQty * requestedComboQty;


            await Product.updateOne(
                {
                    _id: item.productId,
                    superAdminId: hierarchy.superAdminId
                },
                {
                    $inc: {
                        stock: -requiredStock
                    }
                }
            );


        }

        const combo = await ComboOffer.create({
            offerName,
            barcode: barcode ? String(barcode).trim() : null,
            products,
            comboPrice,
            comboQty: requestedComboQty,
            startDate,
            endDate,
            isActive,
            adminId: hierarchy.adminId,
            superAdminId: hierarchy.superAdminId
        });

        return res.status(201).json({
            success: true,
            message: "Combo offer created successfully",
            data: combo
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


exports.searchComboOffers = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const { search = "" } = req.query;

        const filter = {
            superAdminId: hierarchy.superAdminId,
            isActive: true
        };

        if (search.trim()) {
            filter.$or = [
                {
                    offerName: {
                        $regex: search.trim(),
                        $options: "i"
                    }
                },
                {
                    barcode: {
                        $regex: search.trim(),
                        $options: "i"
                    }
                }
            ];
        }

        const combos = await ComboOffer.find(filter)
            .populate("products.productId", "name sellingPrice stock")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Combo offers fetched successfully",
            total: combos.length,
            data: combos
        });

    } catch (error) {
        console.error("SEARCH COMBO OFFER ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};


exports.getAllComboOffers = async (req, res) => {
    try {

        const hierarchy = attachHierarchy(req.user);

        const offers = await ComboOffer.find({
            superAdminId: hierarchy.superAdminId
        })
            .populate("products.productId", "name sellingPrice")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            total: offers.length,
            data: offers
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


exports.getComboOfferById = async (req, res) => {
    try {

        const hierarchy = attachHierarchy(req.user);

        const offer = await ComboOffer.findOne({
            _id: req.params.id,
            superAdminId: hierarchy.superAdminId
        }).populate("products.productId", "name sellingPrice");

        if (!offer)
            return res.status(404).json({
                success: false,
                message: "Combo offer not found"
            });

        res.json({
            success: true,
            data: offer
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};



exports.updateComboOffer = async (req, res) => {
    try {

        const hierarchy = attachHierarchy(req.user);


        const oldOffer = await ComboOffer.findOne({
            _id: req.params.id,
            superAdminId: hierarchy.superAdminId
        });

        if (!oldOffer) {
            return res.status(404).json({
                success: false,
                message: "Combo offer not found"
            });
        }

        const {
            offerName,
            products,
            comboPrice,
            comboQty,
            startDate,
            endDate,
            isActive
        } = req.body;



        if (!offerName) {
            return res.status(400).json({
                success: false,
                message: "Offer name is required"
            });
        }

        if (!products || !products.length) {
            return res.status(400).json({
                success: false,
                message: "Products are required"
            });
        }

        const requestedComboQty = Number(comboQty);

        if (!requestedComboQty || requestedComboQty <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid comboQty is required"
            });
        }



        for (const item of products) {

            const requiredQty = Number(item.qty || 1);

            if (requiredQty <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Product quantity must be greater than 0"
                });
            }

            const product = await Product.findOne({
                _id: item.productId,
                superAdminId: hierarchy.superAdminId
            });

            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found"
                });
            }

            const requiredStock =
                requiredQty * requestedComboQty;



            const oldItem = oldOffer.products.find(
                oldProduct =>
                    String(oldProduct.productId) ===
                    String(item.productId)
            );

            let oldReservedQty = 0;

            if (oldItem) {
                oldReservedQty =
                    Number(oldItem.qty || 1) *
                    Number(oldOffer.comboQty || 0);
            }

            const availableStock =
                Number(product.stock || 0) -
                Number(product.reservedStock || 0) +
                oldReservedQty;

            if (availableStock < requiredStock) {
                return res.status(400).json({
                    success: false,
                    message:
                        `Insufficient stock for ${product.name}. ` +
                        `Required: ${requiredStock}, ` +
                        `Available: ${availableStock}`
                });
            }
        }



        for (const oldItem of oldOffer.products) {

            const restoreQty =
                Number(oldItem.qty || 1) *
                Number(oldOffer.comboQty || 0);

            if (restoreQty <= 0) {
                continue;
            }


            await Product.updateOne(
                {
                    _id: oldItem.productId,
                    superAdminId: hierarchy.superAdminId
                },
                {
                    $inc: {
                        stock: restoreQty
                    }
                }
            );

        }


        for (const item of products) {

            const requiredQty = Number(item.qty || 1);

            const requiredStock =
                requiredQty * requestedComboQty;


            await Product.updateOne(
                {
                    _id: item.productId,
                    superAdminId: hierarchy.superAdminId
                },
                {
                    $inc: {
                        stock: -requiredStock
                    }
                }
            );

        }



        oldOffer.offerName = offerName;
        oldOffer.products = products;
        oldOffer.comboPrice = comboPrice;
        oldOffer.comboQty = requestedComboQty;
        oldOffer.startDate = startDate;
        oldOffer.endDate = endDate;
        oldOffer.isActive = isActive;

        await oldOffer.save();

        return res.json({
            success: true,
            message: "Combo offer updated successfully",
            data: oldOffer
        });

    } catch (err) {

        console.error("updateComboOffer error:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};



exports.deleteComboOffer = async (req, res) => {
    try {

        const hierarchy = attachHierarchy(req.user);


        const offer = await ComboOffer.findOne({
            _id: req.params.id,
            superAdminId: hierarchy.superAdminId
        });

        if (!offer) {
            return res.status(404).json({
                success: false,
                message: "Combo offer not found"
            });
        }


        for (const item of offer.products) {

            const requiredQty = Number(item.qty || 1);

            const restoreQty =
                requiredQty * Number(offer.comboQty || 0);

            if (restoreQty <= 0) {
                continue;
            }


            await Product.updateOne(
                {
                    _id: item.productId,
                    superAdminId: hierarchy.superAdminId
                },
                {
                    $inc: {
                        stock: restoreQty
                    }
                }
            );

        }


        await ComboOffer.deleteOne({
            _id: offer._id
        });

        return res.json({
            success: true,
            message: "Combo offer deleted successfully and stock restored"
        });

    } catch (err) {

        console.error("deleteComboOffer error:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};