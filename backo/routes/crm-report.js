const express = require("express");
const router = express.Router();


const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");

const {
    getCRMReport,
    customerItemWiseReport,
    productWiseCustomerReport,
    customerPurchaseDetails

} = require("../controllers/crm_report");



router.get(
    "/customers/report",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getCRMReport
       
);

router.get(
    "/customer-item-wise",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    customerItemWiseReport
);


router.get("/report/product-wise-customer", verifyToken, authorize("super_admin", "admin", "cashier"), productWiseCustomerReport);


router.get("/report/customer-purchase-details", verifyToken, authorize("super_admin", "admin", "cashier"), customerPurchaseDetails);

module.exports = router;