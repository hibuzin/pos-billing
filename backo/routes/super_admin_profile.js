const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");

const {
    getSuperAdminMe,
    updateSuperAdminMe,
    createSeperateAccount,
    getSeperateAccount,
    updateSeperateAccount
} = require("../controllers/super_admin_profile");


router.post(
    "/seperate/create",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    createSeperateAccount
);



router.get(
    "/me",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getSuperAdminMe
);

router.get(
    "/seperate",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getSeperateAccount
);


router.put(
    "/me",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    updateSuperAdminMe
);

router.put(
    "/seperate/:id",
    verifyToken,
    authorize("super_admin"),
    updateSeperateAccount
);

module.exports = router;