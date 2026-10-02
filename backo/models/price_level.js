const mongoose = require("mongoose");

const slabSchema = new mongoose.Schema({
    minQty: { type: Number, required: true },
    maxQty: { type: Number, default: null },
    price: { type: Number, required: true }
});

const priceLevelSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },

        pricingType: {
            type: String,
            enum: ["manual", "auto", "slab"],
            required: true
        },

        manualPrice: {
            type: Number,
            default: 0
        },

        autoPricing: {
            baseOn: {
                type: String,
                enum: ["costPrice", "mrp"],
                default: "costPrice"
            },
            profitPercent: {
                type: Number,
                default: 0
            }
        },

        slabs: [slabSchema],

        superAdminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

priceLevelSchema.index(
    { productId: 1, superAdminId: 1 },
    { unique: true }
);

module.exports =
    mongoose.models.PriceLevel ||
    mongoose.model("PriceLevel", priceLevelSchema);