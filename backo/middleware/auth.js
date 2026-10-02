const jwt = require("jsonwebtoken");

const tokenBlacklist = new Set();

const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "No token provided" });
    }

    if (tokenBlacklist.has(token)) {
        return res.status(401).json({ message: "Token has been logged out" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = decoded;
        req.token = token;

        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: "Invalid token"
        });
    }
};


const blacklistToken = (token) => {
    tokenBlacklist.add(token);
};

module.exports = { verifyToken, blacklistToken };