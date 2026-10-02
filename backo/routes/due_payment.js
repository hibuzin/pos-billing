const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");

const {
    createDuePayment,
    getAllDuePayments,
    payDuePayment
} = require("../controllers/due_payment");

router.post(
    "/add",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    createDuePayment
);

router.get(
    "/",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getAllDuePayments
);

router.put(
    "/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    payDuePayment
);

module.exports = router;