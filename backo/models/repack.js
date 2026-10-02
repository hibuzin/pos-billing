const mongoose = require("mongoose");

const repackSchema = new mongoose.Schema(
    {
        repackNo: String,

        fromProductId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },

        fromBarcode: String,


        fromUnit: {
            type: String,
            enum: ["pcs", "kg", "g"],
            required: true
        },

        fromUnitValue: {
            type: Number,
            required: true
        },

        outputs: [
            {
                toProductId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product",
                    required: true
                },

                toBarcode: String,

                toQty: {
                    type: Number,
                    required: true
                },

                toUnit: {
                    type: String,
                    enum: ["pcs", "kg", "g"],
                    required: true
                },

                toUnitValue: {
                    type: Number,
                    required: true
                }
            }
        ],

        superAdminId: mongoose.Schema.Types.ObjectId,
        adminId: mongoose.Schema.Types.ObjectId,
        createdBy: mongoose.Schema.Types.ObjectId
    },
    { timestamps: true }
);

module.exports = mongoose.model("Repack", repackSchema);