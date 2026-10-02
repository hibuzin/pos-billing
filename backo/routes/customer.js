const express = require("express");
const router = express.Router();


const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");

const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const upload = multer({ dest: "uploads/" });

const {
    createCustomer,
    payCustomerBalance,
    getCustomerPaymentDetails,
    getCustomerBalanceTotals,
    getCustomers,
    getCustomerBalanceDetails,
    customersSearch,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
    customersExport,
    customersImport
} = require("../controllers/customer");


router.post(
    "/customers",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    createCustomer

);


router.post("/balance-pay",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    payCustomerBalance);


router.get(
    "/payment-details/:customerId",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getCustomerPaymentDetails
);



router.get(
    "/customer-balances",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getCustomerBalanceTotals
);

router.get(
    "/customers",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getCustomers

);

router.get(
    "/customer-balance/:customerId",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getCustomerBalanceDetails
);

router.get(
    "/customers/search",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    customersSearch

);

router.get(
    "/customers/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getCustomerById

);

router.put(
    "/customers/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    updateCustomer

);

router.delete(
    "/customers/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    deleteCustomer

);

router.get(
    "/customers/export",
    verifyToken,
    authorize("super_admin", "admin"),
    customersExport

);

router.post(
    "/customers/import",
    verifyToken,
    authorize("super_admin", "admin"),
    upload.single("file"),
    customersImport

);


module.exports = router;