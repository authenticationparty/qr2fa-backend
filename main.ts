import express from 'express';
const app = express();

// Chalk (console colors)
import chalk from 'chalk';
// Dotenv
import dotenv from 'dotenv';
dotenv.config();

// API default handler
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Welcome to the API',
    });
});

import db from './utility/database';

// Username available check
app.get('/isAvailable', express.json(), async (req, res) => {
    if (!req?.body?.username) {
        res.status(400).json({
            success: false,
            message: 'Invalid request',
        });
    }

    const foundUser = await db.get('users').findOne({
        username: req.body.username,
    });

    return res.status(200).json({
        success: true,
        message: `Username is ${foundUser ? 'not ' : ''}available`,
        available: foundUser == undefined,
    });
});

// Confirm registration on phone
app.get('/register', (req, res) => {
    console.log(req.query);
    res.status(200).json({
        success: true,
        query: req.query,
    });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.info(
        chalk.bgGreenBright(
            chalk.black(`[qr2fa] Listening to ${PORT}`),
        ),
    );
});
