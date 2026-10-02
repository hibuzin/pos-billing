const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");

const AuditLog = require("../models/audit_log");
const { attachHierarchy } = require("../utils/hierarchy");

const{
    getAuditLogs,
    getPurchaseBillWiseItemAudit,
    getBillWiseItemAudit,
    getAuditLogsByid,
    deleteAuditLog
} = require("../controllers/audit_logs");

router.get(
    "/",
    verifyToken,
    authorize("super_admin", "admin"),
    getAuditLogs
       
);


router.get(
    "/Purchase/bill-wise",
    verifyToken,
    authorize("super_admin", "admin"),
    getPurchaseBillWiseItemAudit
);


router.get(
    "/bill/bill-wise",
    verifyToken,
    authorize("super_admin", "admin"),
    getBillWiseItemAudit
);



router.get(
    "/:id",
    verifyToken,
    authorize("super_admin", "admin"),
    getAuditLogsByid
);

router.delete(
    "/:id",
    verifyToken,
    authorize("super_admin"),
    deleteAuditLog
);

module.exports = router;