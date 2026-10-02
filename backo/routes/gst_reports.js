const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");

const Bill = require("../models/bill");
const Purchase = require("../models/purchase");
const authorize = require("../middleware/role");
const { attachHierarchy } = require("../utils/hierarchy");

const{
    getsalesSummary,
    getpurchaseSummary,
    getrateWiseSales,
    getpurchaseregister
} = require("../controllers/gst_reports");


router.get(
    "/sales-summary",
    verifyToken,
    authorize("super_admin", "admin"),
    getsalesSummary
        
);


router.get(
    "/purchase-summary",
    verifyToken,
    authorize("super_admin", "admin"),
    getpurchaseSummary
        
);

router.get(
    "/rate-wise-sales",
    verifyToken,
    authorize("super_admin", "admin"),
    getrateWiseSales
        
);

router.get(
    "/purchase-register",
    verifyToken,
    authorize("super_admin", "admin"),
    getpurchaseregister
       
);

module.exports = router;