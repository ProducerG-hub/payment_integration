require('dotenv').config();
const express = require('express');
const session = require('express-session');
const router = require('./routes/urls');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
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