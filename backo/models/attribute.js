const mongoose = require("mongoose");

const attributeSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        values: [
            {
                type: String,
                trim: true
            }
        ],

        isActive: {
            type: Boolean,
            default: true
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
            ref: "User"
        }
    },
    { timestamps: true }
);

attributeSchema.index(
    { name: 1, superAdminId: 1 },
    { unique: true }
);

module.exports = mongoose.model("Attribute", attributeSchema);