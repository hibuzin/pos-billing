const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");

const {
    addsupplier,
    getSupplierTotals,
    getSupplierBalances,
    getallsuppliers,
    suppliersearch,
    getAllSupplierPurchases,
    supplierPurchases,
    supplierProductWiseSummary,
    supplierbyid,
    updateSupplier,
    deletesupplier
} = require("../controllers/supplier");


router.post(
    "/add",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    addsupplier

);

router.get(
    "/supplier-totals",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getSupplierTotals
);

router.get(
    "/supplier-balances",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getSupplierBalances
);


router.get(
    "/",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getallsuppliers

);


router.get(
    "/search",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    suppliersearch

);

router.get(
    "/supplier-purchases",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getAllSupplierPurchases
);

router.get(
    "/:supplierId/purchases",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    supplierPurchases

);

router.get(
    "/:supplierId/product-wise-summary",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    supplierProductWiseSummary
);

router.get(
    "/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    supplierbyid

);

router.put(
    "/:id",
    verifyToken,
    authorize("super_admin", "admin"),
    updateSupplier

);


router.delete(
    "/:id",
    verifyToken,
    authorize("super_admin", "admin"),
    deletesupplier

);

module.exports = router;