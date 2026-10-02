const mongoose = require("mongoose");

const hsnSchema = new mongoose.Schema({

    hsnCode: {
        type: String,
        required: true
    },

    description: {
        type: String
       
    },

    gstRate: {
        type: Number,
        required: true
    },

    cgst: {
        type: Number,
        default: 0
    },

    sgst: {
        type: Number,
        default: 0
    },

    igst: {
        type: Number,
        default: 0
    },

    cess: {
        type: Number,
        default: 0
    },

    category: {
        type: String,
        default: ""
    },

    isActive: {
        type: Boolean,
        default: true
    },

    superAdminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }

}, { timestamps: true });

module.exports =
    mongoose.models.Hsn ||
    mongoose.model("Hsn", hsnSchema);