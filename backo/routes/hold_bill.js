const express = require("express");
const router = express.Router();


const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");


const {

    createholdbill,
    getholdbill,
    getByidholdbill,
    resumeHoldBill,
    updateholdbill,
    updateholdbillall,
    deleteholdbill
} = require("../controllers/hold-bill");


router.post(
    "/hold",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    createholdbill
);

router.post(
    "/resume/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    resumeHoldBill
);

router.get(
    "/hold",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getholdbill

);



router.get(
    "/hold/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getByidholdbill

);




router.put(
    "/hold/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    updateholdbill

);



router.put(
    "/hold/:id/billed",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    updateholdbillall

);


router.delete(
    "/hold/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    deleteholdbill

);



module.exports = router;