const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");


const {
    createPurchase,
    calculatePurchase,
    getProductForPurchase,
    getPurchasesByDate,
    getPurchaseItemWiseReport,
    getSupplierBalanceBills,
    quickSearchPurchases,
    getPurchases,
    getAllSupplierBalances,
    getPurchaseById,
    updateSupplierBill,
    updatePurchase,
    deleteAllPurchases,
    deletePurchase
    
} = require("../controllers/purchase");


router.post(
    "/calculate",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    calculatePurchase
);

router.post(
    "/purchase",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    createPurchase
);

router.get(
    "/product/:productId",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getProductForPurchase
);


router.get(
    "/search",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    quickSearchPurchases
);


router.get(
    "/supplier-balances",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getAllSupplierBalances
);


router.get(
    "/supplier-balance/:supplierId",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getSupplierBalanceBills
);


router.get(
    "/",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getPurchases

);


router.get("/date",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getPurchasesByDate
);


router.get("/item-wise",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getPurchaseItemWiseReport);



router.get(
    "/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getPurchaseById

);



router.put(
    "/:id",
    verifyToken,
    authorize("super_admin", "admin"),
    updatePurchase
);


router.put(
    "/pay/:purchaseId",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    updateSupplierBill
);



router.delete(
    "/delete/all",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    deleteAllPurchases

);

router.delete(
    "/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    deletePurchase
);


module.exports = router;