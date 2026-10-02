const mongoose = require("mongoose");

const comboOfferSchema = new mongoose.Schema(
    {
        offerName: {
            type: String,
            required: true,
            trim: true
        },

        barcode: {
            type: String,
            default: null
        },

        products: [
            {
                productId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product",
                    required: true
                },
                qty: {
                    type: Number,
                    required: true,
                    min: 1
                }
            }
        ],

        comboPrice: {
            type: Number,
            required: true,
            min: 0
        },

        comboQty: {
            type: Number,
            required: true,
            min: 0
        },



        startDate: {
            type: Date
        },

        endDate: {
            type: Date
        },

        isActive: {
            type: Boolean,
            default: true
        },

        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        superAdminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("ComboOffer", comboOfferSchema);