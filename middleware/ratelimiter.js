const limiter = require('express-rate-limit');

// Rate limiter for payment-related routes which allows a maximum of 5 requests per minute from the same IP address to prevent abuse and ensure fair usage of the payment processing system.
module.exports.Pay_rateLimiter = limiter({
    windowMs: 60 * 1000, // 1 minute
    max: 5, 
    message: {
        status:429,
        message: 'Too many requests, please try again later.'
    }
});

// Rate limiter for webhook endpoint which allows a maximum of 100 requests per minute from the same IP address to prevent abuse and ensure fair usage of the webhook processing system.
module.exports.webhook_rateLimiter = limiter({
    windowMs: 60 * 1000, // 1 minute
    max: 100, 
    message: {
        status:429,
        message: 'Too many requests, please try again later.'
    }
});
