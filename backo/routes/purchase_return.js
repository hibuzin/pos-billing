const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");

const Return = require("../models/return");
const Purchase = require("../models/purchase");
const Product = require("../models/product");
const Supplier = require("../models/supplier");
const { attachHierarchy } = require("../utils/hierarchy");

const {

    createPurchaseReturn,
    getPurchaseByInvoiceNo,
    getBillWisePurchaseReturnReport,
    getItemWisePurchaseReturnReport,
    getPurchaseReturn,
    getByIdPurchaseReturn,
    update_purchase_return_approve,
    update_purchase_return_reject

} = require("../controllers/purchase_return");


router.post("/purchase-return",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    createPurchaseReturn

);

router.get("/purchase/invoice/:invoiceNo",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getPurchaseByInvoiceNo
);

router.get(
    "/purchase-return/bill-wise-report",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getBillWisePurchaseReturnReport
);


router.get(
    "/purchase-return/item-wise",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getItemWisePurchaseReturnReport
);

router.get("/purchase-return",
    verifyToken, authorize
    ("super_admin", "admin", "cashier"),
    getPurchaseReturn

);

router.get("/purchase-return/:id",
    verifyToken, authorize
    ("super_admin", "admin", "cashier"),
    getByIdPurchaseReturn
);

router.put("/purchase-return/:id/approve",
    verifyToken,
    authorize("super_admin", "admin"),
    update_purchase_return_approve

);


router.put("/purchase-return/:id/reject",
    verifyToken,
    authorize("super_admin", "admin"),
    update_purchase_return_reject

);

module.exports = router;