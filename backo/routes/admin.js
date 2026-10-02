const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");

const {
    getAdminMe,
    getAllCashiers
} = require("../controllers/admin");


router.get(
    "/me",
    verifyToken,
    authorize("admin"),
    getAdminMe
);

router.get(
    "/cashiers",
    verifyToken,
    authorize("admin"),
    getAllCashiers
);

module.exports = router;