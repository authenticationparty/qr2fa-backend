import express from 'express';
const app = express();
const PORT = process.env.PORT || 8080;

// Chalk (console colors)
import chalk from 'chalk';
// Joi
import {RegisterSchema, LogInSchema} from './utility/schemas'
// Dotenv
import dotenv from 'dotenv';
dotenv.config();
// Argon
import argon2 from 'argon2';
// Crypto & createHash
import {createHash, randomBytes} from 'crypto';
// Random value to add to hash later on log in
// This prevents users from having their account compromised in case of a cookie steal
// Might fuck with Remember Me tho
const RANDOM_BYTES = randomBytes(128);

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
			FingerprintJS,
			type: 'Registering',
		});
	})
	// API
	.post(express.json(), async (req, res) => {
		// Check if schema is valid
		const userValid = RegisterSchema.validate({
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

		// Hash the password
		const PasswordHash = await argon2.hash(userValid.value.password)

		// Insert into database
		db.get('users').insert({
			username: userValid.value.username,
			password: PasswordHash,
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

// Log In from frontend
app.post('/authenticate', express.json(), async (req, res) => {
	const userValid = LogInSchema.validate(req.body || {});

	if (userValid?.error) {
		return res.status(400).json({
			success: false,
			message: 'Invalid query',
		})
	}

	// Get the user from database
	const User = await db.get('users').findOne({
		username: userValid.value?.username,
	});
	
	// Check if user exists
	if (!User) {
		return res.status(403).json({
			success: false,
			message: 'User does not exist',
		});
	}

	// Check if password is (not) valid
	if (!(await argon2.verify(User?.password, userValid.value?.password))) {
		return res.status(403).json({
			success: false,
			message: 'Invalid password',
		});
	}

	// Create a hash to validate in the WebSocket later on
	const Hash = createHash('sha512')
		.update(`${RANDOM_BYTES}/${User.username}/${User._id}`)
		.digest('hex');

	return res.status(200).json({
		success: true,
		message: 'Successfully logged in',
		Hash,
	})
});

app.route('/acceptLogin')
.get(async (req, res) => {
	res.render('fingerprinting.pug', {
		query: req.query,
		FingerprintJS,
		type: 'Logging in',
	});
})
.post(express.json(), async (req, res) => {
	const
		Fingerprint = req.body?.f0,
		Username = req.body?.username;

	// Body check
	if (!Fingerprint || !Username) {
		return res.status(403).json({
			success: false,
			message: 'Invalid request',
		});
	}

	// Get user
	const User = await db.get('users').findOne({
		username: Username,
	})
	// Check for existance
	if (!User) {
		return res.status(403).json({
			success: false,
			message: 'User does not exist',
		})
	}

	// Fingerprint from Db
	const FP = User?.fingerprint;
	if (!FP) {
		return res.status(403).json({
			success: false,
			message: 'Request a device reset',
		})
	}

	// Check if Fingerprints match
	/**
	 * Meanings:
	 * +: important
	 * ~: might change
	 * -: not important/probably undefined
	 *TODO: Add a confidence system and let user access if scores high enough
	 */
	if (
		// Vendor (+)
		FP.vendor != Fingerprint.vendor ||
		// Canvas B64 (~)
		/* Disabled until confidence system is added
			FP?.canvas?.value?.text+FP?.canvas?.value?.geometry
			!= Fingerprint?.canvas?.value?.text+Fingerprint?.canvas?.value?.geometry ||
			*/
		// Platform (+, shouldn't change)
		FP.platform != Fingerprint.platform ||
		// Timezone (~)
		FP.timezone != Fingerprint.timezone ||
		// Screen resolution (+, it shouldn't change for phones)
		FP.screenResolution != Fingerprint.screenResolution ||
		// Font preferences (+, it shouldn't change for phones)
		FP.fontPreferences != Fingerprint.fontPreferences ||
		// Touch support (+, if this doesn't match it is definitely not the same phone)
		FP.touchSupport != Fingerprint.touchSupport
	) {
		return res.status(403).json({
			success: false,
			message: `Device does not match`,
		});
	}

	const Hash = createHash('sha512')
		.update(`${RANDOM_BYTES}/${User.username}/${User._id}`)
		.digest('hex');

	connectedWs.filter((ws: any) => ws.x_hash == Hash);
	if (connectedWs[0]) {
		User.sessHash = Hash;
		const SessId = createHash('sha512')
			.update(JSON.stringify(User))
			.digest('hex');
		// Update user in db so its easier to find in db later on using the sessid
		db.get('users').update({
			username: User.username
		}, {
			$set: {
				SessId,
			},
		});
		connectedWs[0].send(`.logged${SessId}`);
	}
});

// Super secret page
app.post('/getUser', express.json(), async (req, res) => {
	const SessId = req?.body?.SessId;

	// Find user by session id
	const User = await db.get('users').findOne({SessId});
	
	// Check if SessId exists and matches the one in db
	if (!SessId || !User)
		return res.status(403).json({
			success: false,
			message: 'Invalid session ID, please relog',
			data: {},
		})

	// Remove Fingerprint from user
	User.fingerprint = undefined;
	return res.status(200).json({
		success: true,
		data: User
	})
})

app.listen(PORT, () => {
	console.info(
		chalk.bgGreenBright(
			chalk.black(`[qr2fa] Listening to ${PORT}`),
			),
			);
		});
		