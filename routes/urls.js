const logics = require('../controllers/logics');
const router = require('express').Router();

router.post('/pay', logics.PostPayments);
router.post('/webhook', logics.webhook);

module.exports = router;