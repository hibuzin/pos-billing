const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");

const {
    createRepack,
    searchRepackProducts,
    getRepackProductsByBulk,
    getRepacks,
    getRepackById
} = require("../controllers/repack");

router.post(
    "/create",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    createRepack
);


router.post(
    "/create",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    searchRepackProducts
);


router.get(
    "/repack-by-bulk/:bulkProductId",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getRepackProductsByBulk
);

router.get(
    "/getall",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getRepacks
);


router.get(
    "/search",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    searchRepackProducts
);

router.get(
    "/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getRepackById
);



module.exports = router;