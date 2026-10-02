const mongoose = require("mongoose");


const productSchema = new mongoose.Schema({

    itemCode: {
        type: String,
        required: true,
        trim: true
    },

    productType: {
        type: String,
        enum: ["normal", "bulk", "repack"],
        default: "normal"
    },

    parentProductId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        default: null
    },

    name: { type: String, required: true },

    description: {
        type: String,
        default: "",
        trim: true
    },

    stock: {
        type: Number,
        default: 0
    },

    lowStockQty: {
        type: Number,
        default: 10
    },

    reservedStock: {
        type: Number,
        default: 0
    },

    mrp: {
        type: Number
    },

    unit: {
        type: String,
        enum: ["pcs", "kg", "g"]

    },
    unitValue: {
        type: Number

    },

    costPrice: {
        type: Number,
        default: 0
    },

    sellingPrice: {
        type: Number,
        default: 0
    },

    priceLevel: {
        pricingType: {
            type: String,
            enum: ["manual", "auto", "slab"],
            default: "manual"
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

        slabs: [
            {
                minQty: {
                    type: Number,
                    required: true
                },

                maxQty: {
                    type: Number,
                    default: null
                },

                price: {
                    type: Number,
                    required: true
                }
            }
        ]
    },

    hsnCode: {
        type: String,
        default: ""
    },

gstRate: {
    type: mongoose.Schema.Types.Mixed,
    enum: [0, 5, 12, 18, 40, "none"],
    default: 0
},

    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },

    categoryName: {
        type: String,
        default: ""
    },

    hsnId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Hsn",
        default: null
    },

    superAdminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, { timestamps: true });

productSchema.index(
    { superAdminId: 1, itemCode: 1 },
    { unique: true }
);

module.exports =
    mongoose.models.Product ||
    mongoose.model("Product", productSchema);