const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true
    },

    superAdminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    seq: {
        type: Number,
        default: 0
    }

});

counterSchema.index(
    { name: 1, superAdminId: 1 },
    { unique: true }
);

module.exports =
    mongoose.models.Counter ||
    mongoose.model("Counter", counterSchema);