const Offer = require("../models/offer");

const { attachHierarchy } = require("../utils/hierarchy");


exports.createOffer = async (req, res) => {
    try {

        const {
            offerName,
            offerType = "bill",

            minimumPurchase,
            discountType,
            discountValue,

            buyProductId,
            buyQty,
            freeProductId,
            freeQty,

            startDate,
            endDate
        } = req.body;

        if (!offerName) {
            return res.status(400).json({
                success: false,
                message: "Offer name is required"
            });
        }

        if (offerType === "bill") {

            if (!minimumPurchase || !discountValue) {
                return res.status(400).json({
                    success: false,
                    message: "Minimum purchase and discount value are required"
                });
            }

        }

        if (offerType === "buy_get") {

            if (
                !buyProductId ||
                !buyQty ||
                !freeProductId ||
                !freeQty
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Buy Product, Buy Qty, Free Product and Free Qty are required"
                });
            }

        }

        const hierarchy = attachHierarchy(req.user);

        const offer = await Offer.create({

            offerName,
            offerType,

            minimumPurchase: offerType === "bill" ? minimumPurchase : 0,
            discountType: offerType === "bill" ? discountType : "amount",
            discountValue: offerType === "bill" ? discountValue : 0,

            buyProductId: offerType === "buy_get" ? buyProductId : null,
            buyQty: offerType === "buy_get" ? buyQty : 0,
            freeProductId: offerType === "buy_get" ? freeProductId : null,
            freeQty: offerType === "buy_get" ? freeQty : 0,

            startDate,
            endDate,

            createdBy: req.user.userId,
            ...hierarchy
        });

        res.status(201).json({
            success: true,
            message: "Offer created successfully",
            data: offer
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


exports.getOffers = async (req, res) => {
    try {

        const hierarchy = attachHierarchy(req.user);

        const { name = "" } = req.query;

        const filter = {
            superAdminId: hierarchy.superAdminId
        };

        if (name.trim()) {
            filter.offerName = {
                $regex: name.trim(),
                $options: "i"
            };
        }

        const offers = await Offer.find(filter)
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: offers.length,
            data: offers
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


exports.getOfferById = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const offer = await Offer.findOne({
            _id: req.params.id,
            superAdminId: hierarchy.superAdminId
        });

        if (!offer) {
            return res.status(404).json({
                success: false,
                message: "Offer not found"
            });
        }

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


exports.getActiveOffers = async (req, res) => {
    try {

        const hierarchy = attachHierarchy(req.user);

        const today = new Date();

        const offers = await Offer.find({
            superAdminId: hierarchy.superAdminId,
            isActive: true,
            $or: [
                {
                    startDate: { $exists: false }
                },
                {
                    startDate: { $lte: today }
                }
            ],
            $or: [
                {
                    endDate: { $exists: false }
                },
                {
                    endDate: { $gte: today }
                }
            ]
        });

        res.json({
            success: true,
            data: offers
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


exports.updateOffer = async (req, res) => {
    try {

        const hierarchy = attachHierarchy(req.user);

        const offer = await Offer.findOneAndUpdate(
            {
                _id: req.params.id,
                superAdminId: hierarchy.superAdminId
            },
            req.body,
            {
                new: true
            }
        );

        if (!offer) {
            return res.status(404).json({
                success: false,
                message: "Offer not found"
            });
        }

        res.json({
            success: true,
            message: "Offer updated",
            data: offer
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


exports.toggleOfferStatus = async (req, res) => {
    try {

        const hierarchy = attachHierarchy(req.user);

        const offer = await Offer.findOne({
            _id: req.params.id,
            superAdminId: hierarchy.superAdminId
        });

        if (!offer) {
            return res.status(404).json({
                success: false,
                message: "Offer not found"
            });
        }

        offer.isActive = !offer.isActive;

        await offer.save();

        res.json({
            success: true,
            message: "Offer status updated",
            data: offer
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


exports.deleteOffer = async (req, res) => {
    try {

        const hierarchy = attachHierarchy(req.user);

        const offer = await Offer.findOneAndDelete({
            _id: req.params.id,
            superAdminId: hierarchy.superAdminId
        });

        if (!offer) {
            return res.status(404).json({
                success: false,
                message: "Offer not found"
            });
        }

        res.json({
            success: true,
            message: "Offer deleted"
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};