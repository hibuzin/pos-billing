const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");

const Product = require("../models/product");
const Purchase = require("../models/purchase");
const GRN = require("../models/grn");

const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");
const { attachHierarchy } = require("../utils/hierarchy");


router.post(
  "/grn",
  verifyToken,
  authorize("super_admin", "admin", "cashier"),
  async (req, res) => {
    try {
      const { purchaseId, items } = req.body;

      if (!mongoose.Types.ObjectId.isValid(purchaseId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid purchase id"
        });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Items required"
        });
      }

      const hierarchy = attachHierarchy(req.user);

      const purchase = await Purchase.findOne({
        _id: purchaseId,
        superAdminId: hierarchy.superAdminId
      });

      if (!purchase) {
        return res.status(404).json({
          success: false,
          message: "Purchase not found"
        });
      }

      let totalItems = 0;
      const grnItems = [];

      for (const item of items) {
        const productId = item.productId;
        const receivedQty = Number(item.receivedQty);
        const costPrice = Number(item.costPrice || 0);

        if (!productId || isNaN(receivedQty) || receivedQty <= 0) {
          return res.status(400).json({
            success: false,
            message: "Valid productId and receivedQty required"
          });
        }

        const purchaseItem = purchase.items.find(
          p => p.productId.toString() === productId
        );

        if (!purchaseItem) {
          return res.status(400).json({
            success: false,
            message: "Product not found in this purchase"
          });
        }

        const pendingQty = Number(
          purchaseItem.pendingQty ?? purchaseItem.qty
        );

        if (receivedQty > pendingQty) {
          return res.status(400).json({
            success: false,
            message: `Received qty cannot exceed pending qty. Pending: ${pendingQty}`
          });
        }

        const product = await Product.findOne({
          _id: productId,
          superAdminId: hierarchy.superAdminId
        });

        if (!product) {
          return res.status(404).json({
            success: false,
            message: "Product not found"
          });
        }

        await Product.updateOne(
          {
            _id: productId,
            superAdminId: hierarchy.superAdminId
          },
          {
            $inc: { stock: receivedQty },
            $set: { costPrice }
          }
        );

        purchaseItem.receivedQty =
          Number(purchaseItem.receivedQty || 0) + receivedQty;

        purchaseItem.pendingQty =
          Number(purchaseItem.qty) - Number(purchaseItem.receivedQty);

        grnItems.push({
          productId,
          receivedQty,
          costPrice
        });

        totalItems += receivedQty;
      }

      purchase.grnDate = new Date();
      await purchase.save();

      const grn = await GRN.create({
        purchaseId,
        items: grnItems,
        totalItems,
        isPartial: purchase.items.some(item => Number(item.pendingQty) > 0),
        ...hierarchy,
        createdBy: req.user.userId
      });

      res.status(201).json({
        success: true,
        message: "GRN created and stock added successfully",
        data: grn
      });

    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Server error",
        error: err.message
      });
    }
  }
);


router.get(
  "/grn",
  verifyToken,
  authorize("super_admin", "admin", "cashier"),
  async (req, res) => {
    try {
      const hierarchy = attachHierarchy(req.user);

      const grns = await GRN.find({
        superAdminId: hierarchy.superAdminId
      })
        .populate("purchaseId", "supplierId totalAmount createdAt")
        .populate("items.productId", "name brand stock")
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        count: grns.length,
        data: grns
      });

    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Server error",
        error: err.message
      });
    }
  }
);


router.get(
  "/grn/:id",
  verifyToken,
  authorize("super_admin", "admin", "cashier"),
  async (req, res) => {
    try {
      const hierarchy = attachHierarchy(req.user);

      const grn = await GRN.findOne({
        _id: req.params.id,
        superAdminId: hierarchy.superAdminId
      })
        .populate("purchaseId", "supplierId totalAmount createdAt")
        .populate("items.productId", "name brand stock");

      if (!grn) {
        return res.status(404).json({
          success: false,
          message: "GRN not found"
        });
      }

      res.json({
        success: true,
        data: grn
      });

    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Server error",
        error: err.message
      });
    }
  }
);


router.post("/grn/partial", verifyToken, authorize("super_admin", "admin", "cashier"), async (req, res) => {

  try {

    const {
      purchaseId,
      items
    } = req.body;

    if (!purchaseId || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: "purchaseId and items required"
      });
    }

    const hierarchy = attachHierarchy(req.user);


    const purchase = await Purchase.findOne({
      _id: purchaseId,
      superAdminId: hierarchy.superAdminId
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found"
      });
    }

    const grnItems = [];


    for (const incomingItem of items) {

      const purchaseItem = purchase.items.find(
        p =>
          p.productId.toString() ===
          incomingItem.productId
      );

      if (!purchaseItem) {
        return res.status(400).json({
          success: false,
          message: "Invalid product in purchase"
        });
      }

      const receiveQty = Number(incomingItem.qty);

      if (receiveQty <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid receive qty"
        });
      }

      const pendingQty =
        purchaseItem.qty -
        (purchaseItem.receivedQty || 0);

      if (receiveQty > pendingQty) {
        return res.status(400).json({
          success: false,
          message:
            `Receive qty exceeds pending qty for product`
        });
      }


      purchaseItem.receivedQty =
        (purchaseItem.receivedQty || 0)
        + receiveQty;

      purchaseItem.pendingQty =
        purchaseItem.qty -
        purchaseItem.receivedQty;

      await Product.updateOne(
        {
          _id: incomingItem.productId,
          superAdminId: hierarchy.superAdminId
        },
        {
          $inc: {
            stock: receiveQty
          }
        }
      );

      grnItems.push({
        productId: incomingItem.productId,
        qty: receiveQty,
        costPrice: incomingItem.costPrice || 0
      });
    }


    await purchase.save();


    const grn = await GRN.create({

      purchaseId,

      items: grnItems,

      totalItems: grnItems.length,

      isPartial: true,

      ...hierarchy
    });

    res.status(201).json({
      success: true,
      message: "Partial GRN completed",
      data: grn
    });

  } catch (err) {

    console.error("PARTIAL GRN ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
}
);

router.post("/grn/scan", verifyToken, authorize("super_admin", "admin", "cashier"), async (req, res) => {
  try {
    const {
      purchaseId,
      code,
      qty = 1
    } = req.body;

    if (!purchaseId || !code) {
      return res.status(400).json({
        success: false,
        message: "purchaseId and barcode code required"
      });
    }

    const receiveQty = Number(qty);

    if (receiveQty <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid quantity"
      });
    }

    const hierarchy = attachHierarchy(req.user);


    const purchase = await Purchase.findOne({
      _id: purchaseId,
      superAdminId: hierarchy.superAdminId
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found"
      });
    }


    const barcode = await Barcode.findOne({
      code: String(code).trim(),
      superAdminId: hierarchy.superAdminId
    });

    if (!barcode) {
      return res.status(404).json({
        success: false,
        message: "Barcode not found"
      });
    }


    const product = await Product.findOne({
      _id: barcode.productId,
      superAdminId: hierarchy.superAdminId
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }


    const purchaseItem = purchase.items.find(
      item => item.productId.toString() === product._id.toString()
    );

    if (!purchaseItem) {
      return res.status(400).json({
        success: false,
        message: "This product is not in this purchase"
      });
    }

    const orderedQty = Number(purchaseItem.qty);
    const alreadyReceived = Number(purchaseItem.receivedQty || 0);
    const pendingQty = orderedQty - alreadyReceived;

    if (receiveQty > pendingQty) {
      return res.status(400).json({
        success: false,
        message: `Receive quantity exceeds pending quantity. Pending: ${pendingQty}`
      });
    }


    purchaseItem.receivedQty = alreadyReceived + receiveQty;
    purchaseItem.pendingQty = orderedQty - purchaseItem.receivedQty;


    await Product.updateOne(
      {
        _id: product._id,
        superAdminId: hierarchy.superAdminId
      },
      {
        $inc: {
          stock: receiveQty
        }
      }
    );

    await purchase.save();


    const grn = await GRN.create({
      purchaseId: purchase._id,
      items: [
        {
          productId: product._id,
          qty: receiveQty,
          costPrice: purchaseItem.costPrice || product.costPrice || 0,
          barcodeId: barcode._id,
          barcode: barcode.code
        }
      ],
      totalItems: receiveQty,
      isPartial: purchaseItem.pendingQty > 0,
      receivedByScan: true,
      ...hierarchy
    });

    res.status(201).json({
      success: true,
      message: "GRN barcode scan completed",
      data: {
        grn,
        product: {
          id: product._id,
          name: product.name,
          receivedQty: receiveQty,
          pendingQty: purchaseItem.pendingQty
        }
      }
    });

  } catch (err) {
    console.error("GRN SCAN ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
}
);

module.exports = router;