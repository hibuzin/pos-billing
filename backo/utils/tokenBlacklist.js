const blacklistedTokens = new Set();

const blacklistToken = (token) => {
    blacklistedTokens.add(token);
};

const isBlacklisted = (token) => {
    return blacklistedTokens.has(token);
};

module.exports = {
    blacklistToken,
    isBlacklisted
};