const express = require("express");
const router = express.Router();

const cashRegisterController = require("../controllers/cashregister");
const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");

const {
    openCashRegister,
    getCurrentCashRegister,
    addCashOut,
    closeCashRegister
} = require("../controllers/cashregister");

router.post(
    "/open",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    openCashRegister
);

router.get(
    "/current",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getCurrentCashRegister
);

router.post(
    "/cash-out",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    addCashOut
);

router.post(
    "/close",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    closeCashRegister
);

module.exports = router;