const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");

const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");



const {
    createBill,
    calculateBill,
    searchProductsForBill,
    searchCustomerBills,
    getBills,
    getBillsByDate,
    getItemWiseReport,
    getWalkInCustomerBills,
    salescheck,
    cashierWiseSales,
    getBillById,
    editBill
} = require("../controllers/bill");


router.post(
    "/",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    createBill
);


router.post(
    "/calculate",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    calculateBill
);


router.get("/search-product",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    searchProductsForBill
);

router.get(
    "/search/customer",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    searchCustomerBills
);

router.get(
    "/",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getBills
);


router.get("/date",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getBillsByDate);

router.get("/item-wise",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getItemWiseReport);

router.get("/walk-in-bills",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getWalkInCustomerBills);



router.get(
    "/sales-check",
    verifyToken,
    authorize("super_admin", "admin"),
    salescheck
);



router.get(
    "/cashier-wise-sales",
    verifyToken,
    authorize("super_admin", "admin"),
    cashierWiseSales
);



router.get("/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getBillById
);


router.put("/edit/:billId",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    editBill
);

module.exports = router;