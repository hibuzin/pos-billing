const express = require("express");
const router = express.Router();


const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");

const {

    getReorder,
    getReorderCount  
     
} = require("../controllers/re_order");

router.get("/reorder", verifyToken, authorize("super_admin", "admin", "cashier"),
    getReorder
);



router.get(
    "/reorder/count",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getReorderCount

);

module.exports = router;