const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");




const {
    scanProduct,
    scanProductForPurchase
} = require("../controllers/scan");

router.get(
    "/:code",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    scanProduct

);

router.get(
    "/scan/:code",
    verifyToken,
    authorize("super_admin", "admin"),
    scanProductForPurchase
);


module.exports = router;