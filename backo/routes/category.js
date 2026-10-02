
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");



const {
    createCategory,
    getCategories,
    getCategoryById,
    updateCategory,
    deleteCategory
} = require("../controllers/category");

router.post(
    "/",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    createCategory
);


router.get(
    "/",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getCategories
);


router.get(
    "/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getCategoryById
);



router.put(
    "/:id",
    verifyToken,
    authorize("super_admin", "admin"),
    updateCategory
);


router.delete(
    "/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    deleteCategory
);


module.exports = router;