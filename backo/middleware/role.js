const authorize = (...roles) => {
    return (req, res, next) => {
        try {

            if (!req.user || !req.user.role) {
                return res.status(401).json({
                    success: false,
                    message: "User not found in token"
                });
            }

            const userRole = String(req.user.role);

            if (!roles.includes(userRole)) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied"
                });
            }

            next();

        } catch (err) {
            return res.status(500).json({
                success: false,
                message: "Authorization error"
            });
        }
    };
};

module.exports = authorize;