require('dotenv').config();
const pool = require('../config/database');
const PaymentCallback = require('./simulation').simulatePaymentGatewayCallback;

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
        const query = 'INSERT INTO transactions (phone, amount, reference, status) VALUES ($1, $2, $3, $4) RETURNING *';
        const values = [phone, amount, reference, 'PENDING'];
        const result = await pool.query(query, values);
        await PaymentCallback(reference);// auto callback from the payment gateway after a random delay with a status of either SUCCESS or FAILED
        await pool.query('COMMIT');
        res.status(201).json({message: 'Transaction created successfully', transaction: result.rows[0]});  }
        catch (err) {
        await pool.query('ROLLBACK');
        console.error('Error creating transaction:',
             {
                body: req.body,
                error: err.message
             });
        res.status(500).json({message: 'Internal server error'});
    }
};

// handling the payment gateway callback and updating the transaction status in the database
module.exports.webhook = async (req, res) => {
    try {
        const {reference, status} = req.body;
        const validStatuses = ['PENDING', 'SUCCESS', 'FAILED'];

        //validating the input data
        if (!validStatuses.includes(status)) {
            return res.status(400).json({message: 'Invalid status value'});
        }
        if (!reference || !status) {
            return res.status(400).json({message: 'All fields are required'});
        }

        //PREVENTING DUPLICATE TRANSACTIONS
        const Status = await pool.query('SELECT * FROM transactions WHERE reference = $1', [reference]);
        if(Status.rows[0].status === 'SUCCESS') {
           return res.status(200).json({message: 'Transaction already marked as successful', transaction: Status.rows[0]});
        }

        await pool.query('BEGIN');
        const query = 'UPDATE transactions SET status = $1 WHERE reference = $2 RETURNING *';
        const values = [status, reference];
        const result = await pool.query(query, values);
        await pool.query('COMMIT');
        if (result.rowCount === 0) {
            return res.status(404).json({message: 'Transaction not found'});
        }
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