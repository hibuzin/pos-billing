const express = require("express");
const router = express.Router();

const authorize = require("../middleware/role");
const { verifyToken } = require("../middleware/auth");

const mongoose = require("mongoose");

const {
    
    getAllPurchaseProductHistory,
    getPurchasePriceHistoryByProduct,
   
} = require("../controllers/product_price_history");



router.get(
    "/purchase-history",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getAllPurchaseProductHistory
);

router.get(
    "/purchase-product/:productId",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getPurchasePriceHistoryByProduct
);


module.exports = router;