const express = require("express");
const router = express.Router();

const { verifyToken, blacklistToken } = require("../middleware/auth");
const authorize = require("../middleware/role");


const {

    setupStatus,
    registerSuperAdmin,
    login,
    changePassword,
    changeUserPasswordBySuperAdmin,
    forgotPassword,
    resetPassword,
    logout,

} = require("../controllers/auth");



router.get("/setup-status", setupStatus);

router.post("/register-super-admin", registerSuperAdmin);

router.post("/login", login);




router.put(
    "/change-password",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    changePassword
);


router.put(
    "/change-user-password/:userId",
    verifyToken,
    authorize("super_admin"),
    changeUserPasswordBySuperAdmin
);


router.post("/forgot-password", forgotPassword);

router.post("/reset-password", resetPassword);


router.post(
    "/logout",
    verifyToken,
    logout
);

module.exports = router;