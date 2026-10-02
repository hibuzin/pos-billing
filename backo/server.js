const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();
const cors = require("cors");
const app = express();

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));



const authRoutes = require("./routes/auth");
const superAdminControlRoutes = require("./routes/super_admin_control");
const AdminUserRoutes = require("./routes/admin_user");
const superAdminProfileRoutes = require("./routes/super_admin_profile");
const cashierRoutes = require("./routes/cashier");
const adminRoutes = require("./routes/admin");
const productsRoutes = require("./routes/products");
const productaddRoutes = require("./routes/product_add")
const repackRoutes = require("./routes/repack");
const productPriceHistoryRoutes = require("./routes/product_price_history");
const scanRoutes = require("./routes/scan");
const billRoutes = require("./routes/bill");
const offerRoutes = require("./routes/offer");
const customerRoutes = require("./routes/customer");
const crmReportRoutes = require("./routes/crm-report");
const purchaseRoutes = require("./routes/purchase");
const supplierRoutes = require("./routes/supplier");
const categoryRoutes = require("./routes/category");
const loyaltyRoutes = require("./routes/loyalty");
const DamageRoutes = require("./routes/damage");
const GRNRoutes = require("./routes/grn");
const purchasereturnRoutes = require("./routes/purchase_return");
const reorderRoutes = require("./routes/re_order");
const barcodePrintRoutes = require("./routes/barcode_print");
const StockRebillingRoutes = require("./routes/stock_rebilling");
const salesReturnRoutes = require("./routes/sales_return");
const salesReturnRequestRoutes = require("./routes/sales_return_request");
const holdBillRoutes = require("./routes/hold_bill");
const auditLogRoutes = require("./routes/audit_logs");
const stockLedgerRoutes = require("./routes/stock_ledger");
const gstReportsRoutes = require("./routes/gst_reports");
const gstReturnsRoutes = require("./routes/gst_returns");
const annexureReportsRoutes = require("./routes/annexure_reports");
const stockRoutes = require("./routes/stock");
const brandRoutes = require("./routes/brand");
const attributeRoutes = require("./routes/attribute");
const locationRoutes = require("./routes/location");
const priceLevelRoutes = require("./routes/price_level");
const duePaymentRoutes = require("./routes/due_payment");
const sessionRoutes = require("./routes/session");
const expenseRoutes = require("./routes/expense");
const cashRegisterRoutes = require("./routes/cashregister");
const comboOfferRoutes = require("./routes/combo_offer");
const barcodeGenrateRoutes = require("./routes/barcode_genrate");




app.use("/api/auth", authRoutes);
app.use("/api/super-admin", superAdminControlRoutes);
app.use("/api/admin", AdminUserRoutes);
app.use("/api/profile", superAdminProfileRoutes);
app.use("/api/cashier", cashierRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/repack", repackRoutes);
app.use("/api/productadd", productaddRoutes);
app.use("/api/product-price-history", productPriceHistoryRoutes);
app.use("/api/supplier", supplierRoutes);
app.use("/api/scan", scanRoutes);
app.use("/api/bill", billRoutes);
app.use("/api/offers", require("./routes/offer"));
app.use("/api/customer", customerRoutes);
app.use("/api/crm-report", crmReportRoutes);
app.use("/api/purchase", purchaseRoutes);
app.use("/api/category", categoryRoutes);
app.use("/api/loyalty", loyaltyRoutes);
app.use("/api/damage", DamageRoutes);
app.use("/api/grn", GRNRoutes);
app.use("/api/return", purchasereturnRoutes);
app.use("/api/reorder", reorderRoutes);
app.use("/api/barcode-print", barcodePrintRoutes);
app.use("/api/stock-rebilling", StockRebillingRoutes);
app.use("/api/sales-return", salesReturnRoutes);
app.use("/api/sales-return-request", salesReturnRequestRoutes);
app.use("/api/hold-bill", holdBillRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/stock-ledger", stockLedgerRoutes);
app.use("/api/gst-reports", gstReportsRoutes);
app.use("/api/gst-returns", gstReturnsRoutes);
app.use("/api/annexure-reports", annexureReportsRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/attributes", attributeRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/price-levels", priceLevelRoutes);
app.use("/api/due-payment", duePaymentRoutes);
app.use("/api/session", sessionRoutes);
app.use("/api/expense", expenseRoutes);
app.use("/api/cash-register", cashRegisterRoutes);
app.use("/api/combo-offer", comboOfferRoutes);
app.use("/api/barcode-genrate", barcodeGenrateRoutes);



app.get("/", (req, res) => {
  res.send("Backend is running");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server healthy"
  });
});

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("MONGO_URI is missing");
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });