import express from 'express';
const app = express();
const PORT = process.env.PORT || 8080;

// Chalk (console colors)
import chalk from 'chalk';
// Joi
import {UserSchema} from './utility/schemas'
// Dotenv
import dotenv from 'dotenv';
dotenv.config();

// WebSockets to reload whenever it registers/logins
import WebSocket from 'ws';
const wss = new WebSocket.Server({
	port: Number(PORT) + 1,
})
wss.on('listening', ()=>{
	console.info(
		chalk.bgGreenBright(
			chalk.black(`[qr2fa(ws)] Listening to ${(wss.address() as any).port}`),
		),
	);
});

import {createHash} from 'crypto';
let connectedWs: WebSocket[] = [];
wss.on('connection', (ws: WebSocket) => {
	ws.send('connected');
	ws.on('message', (m) => {
		m = m.toString();
		if (m.startsWith('hash:')) {
			(ws as any).x_hash = m;
			ws.send('x_hash');
			connectedWs.push(ws);
		}
	});
})
wss.on('close', (ws: WebSocket) => {
	connectedWs = connectedWs.filter(x => x != ws);
})

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
async function isAvailable(user: any) {
	const found = await db.get('users').findOne({
		$or: [
			{username: user.username},
			{email: user.email},
		],
	});
	return found == undefined // If found is undefined, user doesn't exist => available, otherwise exists
}

// Username & email available check
app.post('/isAvailable', express.json(), async (req, res) => {
	if (!req?.body?.username || !req?.body?.email) {
		res.status(400).json({
			success: false,
			message: 'Invalid request',
		}).end();
	}
	
	const foundUser = await isAvailable(req.body);
	return res.status(200).json({
		success: true,
		message: `Username/Email is ${foundUser ? 'not ' : ''}available`,
		available: foundUser,
	}).end();
});

// fs
import {readFileSync} from 'fs';
const FingerprintJS = readFileSync('./assets/fingerprint.js');

// Use Pug as engine
app.set('view engine', 'pug');

// Confirm registration on phone
app.route('/register')
	.get((req, res) => {
		res.render('fingerprinting.pug', {
			query: req.query,
			FingerprintJS
		});
	})
	// API
	.post(express.json(), async (req, res) => {
		// Check if schema is valid
		const userValid = UserSchema.validate({
			username: req?.query?.u,
			password: req?.query?.p,
			email: req?.query?.e
		});
		if (userValid?.error) {
			//*TODO: Redirect user to /error?e=${userValid?.error?.message}
			return res.status(400).json({
				success: false,
				message: userValid.error.message,
			})
		}

		// Check if user & email is available
		if (!(await isAvailable(userValid.value))) {
			return res.status(403).json({
				success: false,
				message: 'Username/email is not available',
			})
		}

		// Insert into database
		db.get('users').insert({
			username: userValid.value.username,
			password: userValid.value.password,
			email: userValid.value.email,
			fingerprint: req?.body?.f0 || {},
		});

		const hash = createHash('sha512')
			.update(`${userValid.value.username}:${userValid.value.email}-qr2fa`)
			.digest('hex');
		connectedWs.filter((ws: any) => ws.x_hash == hash);
		if (connectedWs[0]) {
			connectedWs[0].send('.registered');
		}

		//*TODO: Redirect user to you can close this now or something like that
		return res.status(200).json({
			success: true,
			message: `Successfully registered`,
		});
});
app.listen(PORT, () => {
	console.info(
		chalk.bgGreenBright(
			chalk.black(`[qr2fa] Listening to ${PORT}`),
			),
			);
		});
		