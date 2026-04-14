const logics = require('../controllers/logics');
const router = require('express').Router();

router.get('/payments', logics.getPayments);
router.post('/payments', logics.PostPayments);
router.post('/webhook', logics.webhook);

module.exports = router;