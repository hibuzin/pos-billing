const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");

const admin_userController = require("../controllers/admin_user");

router.post(
    "/create-cashier",
    verifyToken,
    authorize("admin"),
    admin_userController.adminCreateCashier
);

module.exports = router;