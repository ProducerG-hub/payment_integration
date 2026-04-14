// simulating the payment gateway callback functionality
require('dotenv').config();
const axios = require('axios'); //for making HTTP requests to the webhook endpoint
const crypto = require('crypto'); //for generating HMAC signature

const simulatePaymentGatewayCallback = async (reference) => {
    console.log('simulation on process ..............');
    try {
        const delay = Math.floor(Math.random() * 5000) + 1000; // Random delay between 1-5 seconds
        const secret = process.env.WEBHOOK_SECRET;
        setTimeout(() => {
            (async () => {
                try {
                    const statuses = ["SUCCESS", "FAILED"];
                    const status = statuses[Math.floor(Math.random() * statuses.length)];
                    const timestamp = Date.now();
                    const signature = crypto.createHmac('sha256', secret).update(reference + status + timestamp + secret).digest('hex'); // Generate HMAC signature
                    await axios.post(process.env.WEBHOOK_URL, {
                        reference,
                        status,
                        timestamp,
                        signature
                    });
                    console.log(`Callback sent for reference: ${reference} with status: ${status}`);
                } catch (error) {
                    console.error(`Callback failed for reference: ${reference}`, error.message);
                }
            })();
        }, delay);
        
    } catch (error) {
        console.error('Error simulating payment gateway callback:', error.message);
        throw error;
    }
};

module.exports = {
    simulatePaymentGatewayCallback
};