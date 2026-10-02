
const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");
const {
    createSalesReturn,
    getBillWiseSalesReturnReport,
    getItemWiseSalesReturnReport,
    getInvoiceForSalesReturn,
    getSalesReturns,
    getSalesReturnById
} = require("../controllers/sales_return");

router.post(
    "/",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    createSalesReturn
);


router.get(
    "/report/bill-wise",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getBillWiseSalesReturnReport
);



router.get(
    "/report/item-wise",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getItemWiseSalesReturnReport
);


router.get(
    "/invoice/:invoiceNo",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getInvoiceForSalesReturn
);


router.get(
    "/",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getSalesReturns
);

router.get(
    "/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getSalesReturnById
);

module.exports = router;