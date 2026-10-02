const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");

const {
    configurePriceLevel,
    getAllPriceLevels,
    getProductPriceLevel,
    updatePriceLevel,
    deletePriceLevel
} = require("../controllers/price_level");

router.post(
    "/configure",
    verifyToken,
    authorize("super_admin", "admin"),
    configurePriceLevel
);



router.get(
    "/",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getAllPriceLevels
);

router.get(
    "/product/:productId",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getProductPriceLevel
);

router.put(
    "/:id",
    verifyToken,
    authorize("super_admin", "admin"),
    updatePriceLevel
);

router.delete(
    "/:id",
    verifyToken,
    authorize("super_admin"),
    deletePriceLevel
);

module.exports = router;