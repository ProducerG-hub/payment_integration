require('dotenv').config();
const pool = require('../config/database');
const crypto = require('crypto'); //for generating HMAC signature
const PaymentCallback = require('./simulation').simulatePaymentGatewayCallback;

const getValidatedWebhookSecret = () => {
    const secret = process.env.WEBHOOK_SECRET;
    if (typeof secret !== 'string' || !secret.trim() || secret.length < 32) {
        return null;
    }
    return secret;
};

module.exports.getPayments = async (req, res) => {
    res.render('home');
}

// sending the payment request to the payment gateway
module.exports.PostPayments = async (req, res) => {
    const client = await pool.connect();
    try{
        const {phone,amount} = req.body;
        const reference = "ORD" + Date.now();
        const validStatuses = ['PENDING', 'SUCCESS', 'FAILED'];

        //validating the input data
        if (!phone || !amount || !reference) {
            return res.status(400).json({message: 'Invalid credentials'});
        }
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({message: 'Invalid credentials'});
        }
        if(!/^\d{10}$/.test(phone)) {
            return res.status(400).json({message: 'Invalid credentials'});
        }
        if(!validStatuses.includes('PENDING')) {
            return res.status(400).json({message: 'Invalid credentials'});
        }

        await client.query('BEGIN');
        // validating if the reference exists in the database before sending the response if the reference is available then the payment should not be processed and an error message should be returned to the client
        const checkQuery = 'SELECT * FROM transactions WHERE reference = $1';
        const checkResult = await client.query(checkQuery, [reference]);
        if (checkResult.rowCount > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({message: 'Invalid credentials'});
        }

        const query = 'INSERT INTO transactions (phone, amount, reference, status) VALUES ($1, $2, $3, $4) RETURNING amount, reference';
        const values = [phone, amount, reference, 'PENDING'];
        const result = await client.query(query, values);
        await PaymentCallback(reference);// auto callback from the payment gateway after a random delay with a status of either SUCCESS or FAILED
        await client.query('COMMIT');
        res.status(201).json({message: 'Transaction created successfully', transaction: result.rows[0]});  
    }
        catch (err) {
        await client.query('ROLLBACK');
        const safeBody ={
            reference: req.body.reference
        }
        console.error('Error creating transaction:',
             {
                body: safeBody,
                error: "Database error or unexpected issue during transaction creation"
             });
        res.status(500).json({message: 'Internal server error'});
    }
    finally {
        client.release();
    }

};

// handling the payment gateway callback and updating the transaction status in the database
module.exports.webhook = async (req, res) => {
    const client = await pool.connect();
    try {
        const {reference, status, signature, timestamp} = req.body;
        const validStatuses = ['PENDING', 'SUCCESS', 'FAILED'];
        const webhookMaxSkewMs =parseInt(process.env.WEBHOOKMAXAGE) || 300000; // 5 minutes default

        //validating the input data
        if (!validStatuses.includes(status)) {
            return res.status(400).json({message: 'Invalid credentials'});
        }
        if (!reference || !status || !signature || !timestamp) {
            return res.status(400).json({message: 'Invalid credentials'});
        }

        // Verify the HMAC signature to ensure the request is from a trusted source
        const secret = getValidatedWebhookSecret();
        if (!secret) {
            console.error('Webhook misconfiguration: WEBHOOK_SECRET is missing or too weak.');
            return res.status(500).json({ message: 'Internal server error' });
        }
        if (!timestamp || isNaN(timestamp)) {
         return res.status(400).json({ message: "Invalid credentials" });
        }

        // Check if the callback is too old or from the future to prevent replay attacks
        const callbackAgeMs = Date.now() - Number(timestamp);
        if (callbackAgeMs < 0 || callbackAgeMs > webhookMaxSkewMs) {
            return res.status(400).json({ message: 'Stale callback rejected' });
        }

        // Generate the expected signature using the same method as the simulation
        const expectedSignature = crypto.createHmac('sha256', secret).update(reference + status + timestamp + secret).digest('hex'); // Generate expected HMAC signature
        const isHexSignature = /^[a-fA-F0-9]+$/.test(signature);
        if (!isHexSignature || signature.length !== expectedSignature.length) {
            console.warn(`Malformed signature for reference ${reference}.`);
            return res.status(400).json({message: 'Invalid credentials'});
        }

        const providedSignatureBuffer = Buffer.from(signature, 'hex');
        const expectedSignatureBuffer = Buffer.from(expectedSignature, 'hex');
        const isSignatureValid = crypto.timingSafeEqual(providedSignatureBuffer, expectedSignatureBuffer);
        if (!isSignatureValid) {
            console.warn(`Invalid signature for reference ${reference}.`);
            return res.status(400).json({message: 'Invalid credentials'});
        }

        await client.query('BEGIN');
        const checkQuery = 'SELECT * FROM transactions WHERE reference = $1';
        const checkResult = await client.query(checkQuery, [reference]);
        if (checkResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({message: 'Transaction not found'});
        }

        const currentStatus = checkResult.rows[0].status;
        if (currentStatus !== "PENDING") {
        await client.query('ROLLBACK');
        return res.status(200).json({ message: "Already finalized" });
        }

        const query = "UPDATE transactions SET status = $1 WHERE reference = $2 RETURNING *";
        const values = [status, reference];
        const result = await client.query(query, values);
        await client.query('COMMIT');
         res.status(200).json({message: 'Transaction updated successfully', transaction: reference});
         console.log('transaction updated successfully', { reference, status });

        
        
    } catch (err) {
        await client.query('ROLLBACK');
        const safeBody ={
            reference: req.body.reference,
            status: req.body.status
        }
        console.error('Error updating transaction:',
             {
                body: safeBody,
                error: "Database error or unexpected issue during webhook processing"
             });
        res.status(500).json({message: 'Internal server error'});
    }
    finally {
        client.release();
    }
};