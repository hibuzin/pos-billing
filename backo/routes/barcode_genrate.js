const express = require("express");
const router = express.Router();


const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");


const {
    generateBarcode
} = require("../controllers/barcode_genrate");


router.post("/generate",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    generateBarcode
);

module.exports = router;