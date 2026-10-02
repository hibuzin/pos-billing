const mongoose = require("mongoose");

const attachHierarchy = (user) => {
    if (!user || !user.userId) {
        throw new Error("Invalid user in token");
    }

    let superAdminId = null;
    let adminId = null;

    if (user.role === "super_admin") {
        superAdminId = user.userId;
    }

    if (user.role === "admin") {
        superAdminId = user.superAdminId;
        adminId = user.userId;
    }

    if (user.role === "cashier") {
        superAdminId = user.superAdminId;
        adminId = user.adminId;
    }

    if (!superAdminId) {
        throw new Error("superAdminId missing in hierarchy");
    }

    return {
        createdBy: new mongoose.Types.ObjectId(user.userId),
        superAdminId: new mongoose.Types.ObjectId(superAdminId),
        adminId: adminId ? new mongoose.Types.ObjectId(adminId) : null
    };
};

module.exports = { attachHierarchy };