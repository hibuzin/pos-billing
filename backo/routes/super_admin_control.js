const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");
const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");

const {
    createUser,
    getAllAdmins,
    getAllCashiers,
    getAdminById,
    getCashierById,
    updateAdmin,
    updateCashier,
    deleteAdmin,
    deleteCashier


} = require("../controllers/super_admin_control");

router.post(
    "/create-user",
    verifyToken,
    authorize("super_admin"),
    createUser
);


router.get(
    "/admins",
    verifyToken,
    authorize("super_admin"),
    getAllAdmins
);

router.get(
    "/cashiers",
    verifyToken,
    authorize("super_admin", "admin"),
    getAllCashiers
);

router.get("/:adminId",
    verifyToken,
    authorize("super_admin"),
    getAdminById
);

router.get("/cashier/:id",
    verifyToken,
    authorize("super_admin"),
    getCashierById
);



router.put(
    "/:adminId",
    verifyToken,
    authorize("super_admin"),
    updateAdmin
);

router.put(
    "/cashier/:id",
    verifyToken,
    authorize("super_admin", "admin"),
    updateCashier
);

router.delete(
    "/:adminId",
    verifyToken,
    authorize("super_admin"),
    deleteAdmin
);


router.delete(
    "/cashier/:id",
    verifyToken,
    authorize("super_admin", "admin"),
    deleteCashier
);


module.exports = router;