// middleware/roleCheck.js
const hasRole = (roles) => {
    return (req, res, next) => {
        const userRoles = req.user.roles.map(role => role.name);
        const hasRequiredRole = roles.some(role => userRoles.includes(role));

        if (!hasRequiredRole) {
            return res.status(403).json({
                message: 'Access denied: insufficient permissions'
            });
        }

        next();
    };
};

module.exports = { hasRole };