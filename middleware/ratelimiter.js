const limiter = require('express-rate-limit');

module.exports.Pay_rateLimiter = limiter({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // limit each IP to 5 requests per windowMs
    message: 'Too many requests, please try again later.'
});

module.exports.webhook_rateLimiter = limiter({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests, please try again later.'
});
