const express = require("express");
const router = express.Router();

const authorize = require("../middleware/role");
const { verifyToken } = require("../middleware/auth");
const mongoose = require("mongoose");



const generateBarcode = () => {
    return Math.floor(100000000000 + Math.random() * 900000000000).toString();
};

const {
    productcreate,
    bulkProductCreate,
    getproductMrps,
    getProductsByType,
    allProducts,
    searchProducts,
    searchProductsByCategory,
    getAllPriceHistory,
    ProductsById,
    getProductPriceHistoryById,
    updateProduct,
    deleteAllProducts,
    deleteProduct

} = require("../controllers/product_add");

router.post(
    "/add",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    productcreate,

);

router.post("/bulk-add", verifyToken, authorize("super_admin", "admin", "cashier"), bulkProductCreate);

router.get(
    "/product-mrps/:productId",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getproductMrps,
);

router.get(
    "/product-type",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getProductsByType,
);


router.get(
    "/",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    allProducts,
);

router.get(
    "/price-history",
     verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getAllPriceHistory
);


router.get(
    "/search",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    searchProducts
);


router.get(
    "/category/:categoryId",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    searchProductsByCategory
);


router.get(
    "/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    ProductsById
);



router.get(
    "/price-history/:productId",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getProductPriceHistoryById
);


router.put(
    "/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    updateProduct
);



router.delete(
    "/delete/all",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    deleteAllProducts
);



router.delete(
    "/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    deleteProduct
);


module.exports = router;