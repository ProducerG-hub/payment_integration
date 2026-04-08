// simulating the payment gateway callback functionality
require('dotenv').config();
const axios = require('axios'); //for making HTTP requests to the webhook endpoint
const crypto = require('crypto'); //for generating HMAC signature

const simulatePaymentGatewayCallback = async (reference) => {
    console.log('simulation on process ..............');
    try {
        const delay = Math.floor(Math.random() * 5000) + 1000; // Random delay between 1-5 seconds
        const secret = process.env.WEBHOOK_SECRET;
        setTimeout(async () => {
            const status = Math.random() < 0.8 ? 'SUCCESS' : 'FAILED'; // 80% chance of success
            const signature = crypto.createHash('sha256').update(reference + status + secret).digest('hex'); // Generate HMAC signature
            await axios.post(process.env.WEBHOOK_URL, {
                reference,
                status,
                signature
            });
            console.log(`Callback sent for reference: ${reference} with status: ${status}`);
            }, delay);
        
    } catch (error) {
        console.error('Error simulating payment gateway callback:', error.message);
        throw error;
    }
};

module.exports = {
    simulatePaymentGatewayCallback
};