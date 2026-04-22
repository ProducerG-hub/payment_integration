// simulating the payment gateway callback functionality
require('dotenv').config();
const axios = require('axios'); //for making HTTP requests to the webhook endpoint
const crypto = require('crypto'); //for generating HMAC signature

const getValidatedWebhookSecret = () => {
    const secret = process.env.WEBHOOK_SECRET;
    if (typeof secret !== 'string' || !secret.trim() || secret.length < 32) {
        return null;
    }
    return secret;
};

const simulatePaymentGatewayCallback = async (reference) => {
    console.log('simulation on process ..............');
    try {
        const delay = Math.floor(Math.random() * 5000) + 1000; // Random delay between 1-5 seconds
        const secret = getValidatedWebhookSecret();
        if (!secret) {
            console.error('Webhook misconfiguration: WEBHOOK_SECRET is missing or too weak.');
            return;
        }
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
                    console.error(`Callback failed for reference: ${reference}`, {
                        message: "Unexpected error occured during processing the callback"
                    });
                }
            })();
        }, delay);
        
    } catch (error) {
        console.error('Unexpected error occured during simulation');
    }
};

module.exports = {
    simulatePaymentGatewayCallback
};