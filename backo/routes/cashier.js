const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");

const {
    getCashierMe
} = require("../controllers/cashier");

router.get(
    "/me",
    verifyToken,
    authorize("cashier"),
    getCashierMe
);

module.exports = router;