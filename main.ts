import express from 'express';
const app = express();

// Chalk (console colors)
import chalk from 'chalk';
// Dotenv
import dotenv from 'dotenv';
dotenv.config();

// CORS
app.use((req, res, next) => {
	res.setHeader('Access-Control-Allow-Headers', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
	res.setHeader('Access-Control-Allow-Origin', '*');
	next();
});

// API default handler
app.get('/', (req, res) => {
	res.status(200).json({
		success: true,
		message: 'Welcome to the API',
	});
});

// Import database
import db from './utility/database';
// Username & email available check
app.post('/isAvailable', express.json(), async (req, res) => {
	if (!req?.body?.username || !req?.body?.email) {
		res.status(400).json({
			success: false,
			message: 'Invalid request',
		}).end();
	}
	
	const foundUser = await db.get('users').findOne({
		$or: [
			{username: req.body.username},
			{email: req.body.email},
		],
	});
	
	return res.status(200).json({
		success: true,
		message: `Username/Email is ${foundUser ? 'not ' : ''}available`,
		available: foundUser == undefined,
	}).end();
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
		