import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import passport, { AuthenticateCallback } from 'passport';
import { body } from 'express-validator';
import { hash, argon2id } from 'argon2';
import { randomInt } from 'node:crypto';
import Mailgun from 'mailgun.js';
import mjml2html from 'mjml';

import { authenticate } from '../middlewares/authenticate.js';
import { validationCSRF } from '../middlewares/validationCSRF.js';
import { validationScheme } from '../middlewares/validationScheme.js';
import { generateCSRFToken } from '../utils/generateCSRFToken.js';
import { User } from '../models/user.js';
import { Code } from '../models/code.js';

const mailgun = new Mailgun(FormData);
const mg = mailgun.client({
	username: 'api',
	key: process.env.MAINGUN_API_KEY as string,
});

export const googleLogin: RequestHandler = passport.authenticate('google');
export const googleRedirect: RequestHandler[] = [
	(req, res, next) => {
		const authenticateCb: AuthenticateCallback = (err, user) => {
			err && next(err);
			user &&
				req.login(user, () => {
					res
						.set('Cache-Control', 'no-cache=Set-Cookie') // To avoid the private or sensitive data exchanged within the session through the web browser cache after the session has been closed.
						.cookie(
							process.env.NODE_ENV === 'production'
								? '__Secure-token'
								: 'token',
							generateCSRFToken(req.sessionID),
							{
								sameSite: 'strict',
								httpOnly: false, // Front-end need to access __Secure-token cookie
								secure: process.env.NODE_ENV === 'production',
								domain: process.env.DOMAIN ?? '',
								maxAge: req.session.cookie.originalMaxAge ?? Date.now(),
							},
						)
						.redirect(process.env.HELOG_URL!);
				});
		};

		const authenticateFn = passport.authenticate('google', authenticateCb);
		authenticateFn(req, res, next);
	},
];
export const facebookLogin: RequestHandler = passport.authenticate('facebook');
export const facebookRedirect: RequestHandler[] = [
	(req, res, next) => {
		if (req.query.code) {
			next();
		} else {
			res.redirect('/account/login');
		}
	},
	(req, res, next) => {
		const authenticateCb: AuthenticateCallback = (err, user) => {
			err && next(err);
			user &&
				req.login(user, () => {
					res
						.set('Cache-Control', 'no-cache=Set-Cookie') // To avoid the private or sensitive data exchanged within the session through the web browser cache after the session has been closed.
						.cookie(
							process.env.NODE_ENV === 'production'
								? '__Secure-token'
								: 'token',
							generateCSRFToken(req.sessionID),
							{
								sameSite: 'strict',
								httpOnly: false, // Front-end need to access __Secure-token cookie
								domain: process.env.DOMAIN ?? '',
								secure: process.env.NODE_ENV === 'production',
								maxAge: req.session.cookie.originalMaxAge ?? Date.now(),
							},
						)
						.redirect(process.env.HELOG_URL!);
				});
		};
		const authenticateFn = passport.authenticate('facebook', authenticateCb);
		authenticateFn(req, res, next);
	},
];
export const userLogout: RequestHandler[] = [
	authenticate,
	validationCSRF,
	(req, res) => {
		req.session.destroy(() =>
			res.set('Clear-Site-Data', ['cache', 'cookies', 'storage']).json({
				success: true,
				message: 'User logout successfully.',
			}),
		);
	},
];

export const register: RequestHandler[] = [
	body('email')
		.trim()
		.toLowerCase()
		.isEmail()
		.withMessage('The email address must be in the correct format.'),
	body('password')
		.isLength({ min: 8, max: 64 })
		.withMessage(
			'The password length must be greater than 8 characters or you can use passphrases less than 64 characters.',
		),
	body('confirmPassword')
		.custom((value, { req }) => value === req.body.password)
		.withMessage('The confirmation password is not the same as the password.'),
	validationScheme,
	asyncHandler(async (req, res, next) => {
		const { password, email } = req.data;

		const code = randomInt(100000, 999999).toString();

		const hashedPassword = await hash(password, {
			type: argon2id,
			memoryCost: 47104,
			timeCost: 1,
			parallelism: 1,
		});

		const hashedCode = await hash(code, {
			type: argon2id,
			memoryCost: 47104,
			timeCost: 1,
			parallelism: 1,
		});

		const fiveMins = Date.now() + 5 * 60 * 1000;

		const newUser = new User({
			password: hashedPassword,
			isAdmin: process.env.NODE_ENV === 'development',
			expiresAfter: new Date(fiveMins),
		});

		const newCode = new Code({
			user: newUser.id,
			code: hashedCode,
			email,
			expiresAfter: new Date(fiveMins),
		});

		await Promise.all([newUser.save(), newCode.save()]);
		req.code = code;
		next();
	}),
	asyncHandler(async (req, res) => {
		const { email } = req.data;

		const code = req.code as string;

		const emailTemplate = mjml2html(
			`
		    <mjml>
		      <mj-body>
		        <mj-section background-color="#26ACA3">
		          <mj-column>
		            <mj-text font-style="italic" font-size="20px" font-family="Helvetica Neue" color="#ffffff">
		              Helog Verification Code
		            </mj-text>
		          </mj-column>
		        </mj-section>

		        <mj-section background-color="#F5F8FE">
		          <mj-column>
		            <mj-text>
		              Dear Helog User,
		            </mj-text>
		            <mj-text>
		              We received a request to verify your email address.
		            </mj-text>

		            <mj-divider border-width="1px" border-style="solid" border-color="lightgrey" />
		            <mj-text>
		              Your Helog verification code is:

		            </mj-text>
		            <mj-text align="center" font-size="20px">
		              ${code.split('').join(' ')}
		            </mj-text>
		            <mj-text align="center" font-weight="bold">
		              This code will expire in 5 minutes.
		            </mj-text>

		            <mj-divider border-width="1px" border-style="solid" border-color="lightgrey" />

		            <mj-text>
		              This is an automated email. If you received it by mistake, you don’t need to do anything.
		            </mj-text>

		            <mj-text>
		              If you have any questions, contact <a href="https://helog.whitesgr03.me/" target="_blank">Helog</a> to get support.</mj-text>
		            <mj-text>@ 2025 Helog</mj-text>
		          </mj-column>
		        </mj-section>
		      </mj-body>
		    </mjml>
		  `,
		);

		const msg = {
			from: `Helog <no-reply@${process.env.MAINGUN_DOMAIN}>`,
			to: email,
			subject: 'Account Verification',
			html: emailTemplate.html,
		};

		await mg.messages.create(process.env.MAINGUN_DOMAIN as string, msg);

		res.json({
			success: true,
			message: 'The verification code is sending',
		});
	}),
];
