require('dotenv').config();
const express = require('express');
const router = require('./routes/urls');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(router)

app.get('/', (req, res) => {
    res.send('Welcome to the payment API');
});

// gracefull shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    process.exit();
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});