require('dotenv').config();
const pool = require('../config/database');
const crypto = require('crypto'); //for generating HMAC signature
const PaymentCallback = require('./simulation').simulatePaymentGatewayCallback;

module.exports.getPayments = async (req, res) => {
    res.render('home');
}

// sending the payment request to the payment gateway
module.exports.PostPayments = async (req, res) => {
    try{
        const {phone,amount} = req.body;
        const reference = "ORD" + Date.now();
        const validStatuses = ['PENDING', 'SUCCESS', 'FAILED'];

        //validating the input data
        if (!phone || !amount || !reference) {
            return res.status(400).json({message: 'All fields are required'});
        }
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({message: 'Invalid amount value'});
        }
        if(!/^\d{10}$/.test(phone)) {
            return res.status(400).json({message: 'Phone number must be 10 digits'});
        }
        if(!validStatuses.includes('PENDING')) {
            return res.status(400).json({message: 'Invalid status value'});
        }

        await pool.query('BEGIN');
        // validating if the reference exists in the database before sending the response if the reference is available then the payment should not be processed and an error message should be returned to the client
        const checkQuery = 'SELECT * FROM transactions WHERE reference = $1';
        const checkResult = await pool.query(checkQuery, [reference]);
        if (checkResult.rowCount > 0) {
            await pool.query('ROLLBACK');
            return res.status(400).json({message: 'Reference already exists'});
        }

        const query = 'INSERT INTO transactions (phone, amount, reference, status) VALUES ($1, $2, $3, $4) RETURNING *';
        const values = [phone, amount, reference, 'PENDING'];
        const result = await pool.query(query, values);
        await PaymentCallback(reference);// auto callback from the payment gateway after a random delay with a status of either SUCCESS or FAILED
        await pool.query('COMMIT');
        res.status(201).json({message: 'Transaction created successfully', transaction: result.rows[0]});  
    }
        catch (err) {
        await pool.query('ROLLBACK');
        console.error('Error creating transaction:',
             {
                body: req.body.reference,
                error: err.message
             });
        res.status(500).json({message: 'Internal server error'});
    }
};

// handling the payment gateway callback and updating the transaction status in the database
module.exports.webhook = async (req, res) => {
    try {
        const {reference, status, signature, timestamp} = req.body;
        const validStatuses = ['PENDING', 'SUCCESS', 'FAILED'];
        const webhookMaxSkewMs = process.env.WEBHOOKMAXAGE || 300000; // 5 minutes default

        //validating the input data
        if (!validStatuses.includes(status)) {
            return res.status(400).json({message: 'Invalid status value'});
        }
        if (!reference || !status || !signature || !timestamp) {
            return res.status(400).json({message: 'All fields are required'});
        }

        // Verify the HMAC signature to ensure the request is from a trusted source
        const secret = process.env.WEBHOOK_SECRET;
        if (!timestamp || isNaN(timestamp)) {
         return res.status(400).json({ message: "Invalid timestamp" });
        }

        // Check if the callback is too old or from the future to prevent replay attacks
        const callbackAgeMs = Date.now() - Number(timestamp);
        if (callbackAgeMs < 0 || callbackAgeMs > webhookMaxSkewMs) {
            return res.status(400).json({ message: 'Stale callback rejected' });
        }

        // Generate the expected signature using the same method as the simulation
        const expectedSignature = crypto.createHmac('sha256', secret).update(reference + status + timestamp + secret).digest('hex'); // Generate expected HMAC signature
        if (signature !== expectedSignature) {
            console.warn(`Invalid signature for reference ${reference}.`);
            return res.status(400).json({message: 'Invalid signature'});
        }

        await pool.query('BEGIN');
        const checkQuery = 'SELECT * FROM transactions WHERE reference = $1';
        const checkResult = await pool.query(checkQuery, [reference]);
        if (checkResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({message: 'Transaction not found'});
        }

        const currentStatus = checkResult.rows[0].status;
        if (currentStatus !== "PENDING") {
        await pool.query('ROLLBACK');
        return res.status(200).json({ message: "Already finalized" });
        }

        const query = "UPDATE transactions SET status = $1 WHERE reference = $2 RETURNING *";
        const values = [status, reference];
        const result = await pool.query(query, values);
        await pool.query('COMMIT');
         res.status(200).json({message: 'Transaction updated successfully', transaction: result.rows[0]});

        
        
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Error updating transaction:',
             {
                body: req.body,
                error: err.message
             });
        res.status(500).json({message: 'Internal server error'});
    }
};