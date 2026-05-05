const logics = require('../controllers/logics');
const router = require('express').Router();
const limiter = require('../middleware/ratelimiter');

router.get('/payments', limiter.Pay_rateLimiter, logics.getPayments);
router.post('/payments', limiter.Pay_rateLimiter, logics.PostPayments);
router.post('/webhook', limiter.webhook_rateLimiter, logics.webhook);
router.get('/success/:reference', logics.getAccessPage);
router.get('/dashboard', logics.getDashboard);
module.exports = router;