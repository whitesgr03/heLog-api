import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import passport, { AuthenticateCallback } from 'passport';
import { body } from 'express-validator';
import { hash, verify, argon2id } from 'argon2';
import { randomInt, randomBytes } from 'node:crypto';
import mjml2html from 'mjml';
import mongoose from 'mongoose';

import { authenticate } from '../middlewares/authenticate.js';
import { validationCSRF } from '../middlewares/validationCSRF.js';
import { validationScheme } from '../middlewares/validationScheme.js';
import { generateCSRFToken } from '../utils/generateCSRFToken.js';
import { User } from '../models/user.js';
import { Code } from '../models/code.js';
import { Token } from '../models/token.js';

import { sendEmail } from '../utils/sendEmail.js';
import {
	limiterLoginFailsByEmail,
	limiterRequestRegistrationByIp,
	limiterRequestResettingPasswordByEmail,
	limiterVerifyCodeByEmail,
} from '../utils/rateLimiter.js';
import { RateLimiterRes } from 'rate-limiter-flexible';

declare module 'express-session' {
	interface SessionData {
		email: string;
	}
}

export const federatedLogin: RequestHandler = (req, res, next) =>
	passport.authenticate(req.params.federation)(req, res, next);

export const federatedRedirect: RequestHandler = asyncHandler(
	(req, res, next) => {
		if (!req.query.code) {
			res.redirect(`${process.env.HELOG_ACCOUNT}/sign-in`);
		} else {
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
			const authenticateFn = passport.authenticate(
				req.params.federation,
				authenticateCb,
			);
			authenticateFn(req, res, next);
		}
	},
);

export const userLogout: RequestHandler[] = [
	authenticate,
	validationCSRF,
	(req, res, next) => {
		req.session.destroy(error => {
			if (error) {
				next(error);
			} else {
				res
					.clearCookie(
						process.env.NODE_ENV === 'production' ? '__Secure-token' : 'token',
						{ domain: process.env.DOMAIN ?? '' },
					)
					.clearCookie(
						process.env.NODE_ENV === 'production' ? '__Secure-id' : 'id',
						{
							domain: process.env.DOMAIN ?? '',
						},
					)
					.json({
						success: true,
						message: 'User logout successfully.',
					});
			}
		});
	},
];
export const login: RequestHandler[] = [
	body('email').trim().notEmpty().withMessage('The email is required.'),
	body('password').notEmpty().withMessage('The password is required.'),
	validationScheme,
	asyncHandler(async (req, res, next) => {
		const { email } = req.data;

		try {
			await limiterLoginFailsByEmail.consume(email);
		} catch (rejected) {
			if (rejected instanceof RateLimiterRes) {
				res
					.status(429)
					.set('Retry-After', rejected.msBeforeNext.toString())
					.json({
						success: false,
						message: 'You have login fails too many times',
					});
				return;
			} else {
				throw rejected;
			}
		}

		const authenticateCb: AuthenticateCallback = async (err, user) => {
			err && next(err);

			if (user) {
				req.login(user, async () => {
					await limiterLoginFailsByEmail.delete(email);
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
						.json({
							success: true,
							message: 'User login successfully',
						});
				});
			} else {
				res.status(401).json({
					success: false,
					fields: {
						email: 'The email was incorrect.',
						password: 'The password was incorrect.',
					},
				});
			}
		};

		const authenticateFn = passport.authenticate('local', authenticateCb);
		authenticateFn(req, res, next);
	}),
];

export const requestRegistration: RequestHandler[] = [
	body('displayName')
		.trim()
		.notEmpty()
		.withMessage('The display name is required.')
		.bail()
		.isLength({ max: 30 })
		.withMessage('The display name length must be less then 30.')
		.bail()
		.custom(value => value.match(/^[a-zA-Z]\w*$/))
		.withMessage(
			'The display name must begin with alphabet and include alphanumeric or underscore.',
		)
		.bail()
		.custom(
			async value =>
				await new Promise(async (resolve, reject) => {
					const existingUsername = await User.findOne({
						displayName: value,
					}).exec();
					existingUsername ? reject() : resolve(true);
				}),
		)
		.withMessage('The display name is been used.'),
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
	asyncHandler(async (req, res) => {
		try {
			await limiterRequestRegistrationByIp.consume(req.ip as string);
		} catch (rejected) {
			if (rejected instanceof RateLimiterRes) {
				res
					.status(429)
					.set('Retry-After', rejected.msBeforeNext.toString())
					.json({
						success: false,
						message: 'You have registered too many times',
					});
				return;
			} else {
				throw rejected;
			}
		}
		const { displayName, password, email } = req.data;

		const user = await User.findOne({ email }).exec();

		let emailTemplate = null;

		if (user) {
			emailTemplate = mjml2html(
				`
		    <mjml>
          <mj-body>
            <mj-section background-color="#26ACA3">
              <mj-column>

                <mj-text font-style="italic" font-size="20px" font-family="Helvetica Neue" color="#ffffff">
                  Helog New Account registration
                </mj-text>

              </mj-column>
            </mj-section>

            <mj-section background-color="#F5F8FE">
              <mj-column>

                <mj-text>
                  Dear Helog User,
                </mj-text>

                <mj-text>
                  We received a request recently made to register for a new account with this email address, but there is already an active account associated with the email address.
                </mj-text>

                <mj-text>
                  You can log in with your password or if you forgot your password, you can reset your password.
                </mj-text>

                <mj-divider border-width="1px" border-style="solid" border-color="lightgrey" />

                <mj-text>
                  This is an automated email. If you did not make this registration attempt, you can ignore or delete this email.
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
		} else {
			const token = randomBytes(32).toString('hex');

			const hashedPassword = await hash(password, {
				type: argon2id,
				memoryCost: 47104,
				timeCost: 1,
				parallelism: 1,
			});

			const hashedToken = await hash(token, {
				type: argon2id,
				memoryCost: 47104,
				timeCost: 1,
				parallelism: 1,
			});

			const fiveMins = 5 * 60 * 1000;

			const currentTime = Date.now();

			const newUser = new User({
				displayName,
				password: hashedPassword,
				isAdmin: process.env.NODE_ENV === 'development',
				expiresAfter: new Date(currentTime + fiveMins),
			});

			const newToken = new Token({
				user: newUser.id,
				token: hashedToken,
				email,
				expiresAfter: new Date(currentTime + fiveMins),
			});

			const unusedToken = await Token.findOneAndDelete({ email }).exec();

			if (unusedToken) {
				await User.findByIdAndDelete(unusedToken.user).exec();
			}

			await Promise.all([newUser.save(), newToken.save()]);

			const verificationUrl =
				process.env.NODE_ENV === 'production'
					? `https://account.helog.whitesgr03.me/account?identity=${newToken.id}&token=${token}`
					: `http://localhost:8001/account?identity=${newToken.id}&token=${token}`;

			emailTemplate = mjml2html(
				`
			  <mjml>
			    <mj-body>
			      <mj-section background-color="#26ACA3">
			        <mj-column>

			          <mj-text font-style="italic" font-size="20px" font-family="Helvetica Neue" color="#ffffff">
			            Helog New Account registration
			          </mj-text>

			        </mj-column>
			      </mj-section>

			      <mj-section background-color="#F5F8FE">
			        <mj-column>

			          <mj-text>
			            Dear Helog User,
			          </mj-text>

			          <mj-text>
			            We received a request to register for a new account with this email address.
			          </mj-text>

			          <mj-divider border-width="1px" border-style="solid" border-color="lightgrey" />

			          <mj-text>
			            Click link to verify your email address:

			          </mj-text>

			          <mj-button href="${verificationUrl}" target="_blank" font-family="Helvetica" background-color="#F45E43" color="white" title="${verificationUrl}">
			            Verification Link
			          </mj-button>

			          <mj-text align="center" font-weight="bold">
			            This link will expire in 5 minutes.
			          </mj-text>

			          <mj-divider border-width="1px" border-style="solid" border-color="lightgrey" />

			          <mj-text>
			            This is an automated email. If you did not make this registration, please do not click it and you can ignore or delete this email.
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
		}

		await sendEmail({
			receiver: email,
			subject: 'Account registration',
			html: emailTemplate.html,
		});

		res.json({
			success: true,
			message: 'The verification token is sending',
		});
	}),
];
export const register: RequestHandler[] = [
	asyncHandler(async (req, res) => {
		const rateLimiterRes = await limiterRequestRegistrationByIp.get(
			req.ip as string,
		);

		if (!rateLimiterRes) {
			res.status(428).json({
				success: false,
				message: 'You have not applied to register an account.',
			});
			return;
		}

		if (rateLimiterRes.remainingPoints <= 0) {
			res
				.status(429)
				.set('Retry-After', rateLimiterRes.msBeforeNext.toString())
				.json({
					success: false,
					message: 'You have registered too many times',
				});
			return;
		}

		const tokenDoc =
			mongoose.isValidObjectId(req.body.tokenId) &&
			(await Token.findById(req.body.tokenId).exec());

		if (
			!tokenDoc ||
			!(await verify(tokenDoc.token as string, req.body.token))
		) {
			res.status(401).json({
				success: false,
				message: 'Token is invalid.',
			});
			return;
		}

		await User.findByIdAndUpdate(tokenDoc.user, {
			email: tokenDoc.email,
			$unset: { expiresAfter: '' },
		});

		res.json({
			success: true,
			message: 'Account registration is successfully.',
		});
	}),
];

export const requestVerificationCode: RequestHandler[] = [
	body('email')
		.trim()
		.toLowerCase()
		.isEmail()
		.withMessage('The email address must be in the correct format.'),
	validationScheme,
	asyncHandler(async (req, res) => {
		const { email } = req.data;
		const rateLimiterRes = await limiterRequestResettingPasswordByEmail.get(
			email as string,
		);

		if (!rateLimiterRes) {
			res.status(428).json({
				success: false,
				message: 'You have not applied to reset password.',
			});
			return;
		}

		try {
			await limiterRequestResettingPasswordByEmail.consume(email);
		} catch (rejected) {
			if (rejected instanceof RateLimiterRes) {
				res
					.status(429)
					.set('Retry-After', rejected.msBeforeNext.toString())
					.json({
						success: false,
						message: 'You have resend code too many times',
					});
			} else {
				throw rejected;
			}
		}

		const newCode = randomInt(100000, 999999).toString();
		const fiveMins = Date.now() + 5 * 60 * 1000;

		const hashedCode = await hash(newCode, {
			type: argon2id,
			memoryCost: 47104,
			timeCost: 1,
			parallelism: 1,
		});

		const codeDoc = await Code.findOneAndUpdate(
			{ email: email },
			{ code: hashedCode, expiresAfter: new Date(fiveMins) },
		).exec();

		if (!codeDoc) {
			res.status(401).json({
				success: false,
				message: 'The verification code is expired',
			});
			return;
		}

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
			                  We received a request to reset your password.
			                </mj-text>

			                <mj-divider border-width="1px" border-style="solid" border-color="lightgrey" />
			                <mj-text>
			                  Your Helog verification code is:

			                </mj-text>
			                <mj-text align="center" font-size="20px" letter-spacing="8px">
			                  ${newCode}
			                </mj-text>
			                <mj-text align="center" font-weight="bold">
			                  This code will expire in 5 minutes.
			                </mj-text>

			                <mj-divider border-width="1px" border-style="solid" border-color="lightgrey" />

			                <mj-text>
			                  This is an automated email. If you received it by mistake, you don't need to do anything.
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
		await Promise.all([
			sendEmail({
				receiver: email,
				subject: 'Information regarding your password reset request',
				html: emailTemplate.html,
			}),
			limiterVerifyCodeByEmail.delete(email),
		]);

		res.json({
			success: true,
			message: 'The verification code is sending',
		});
	}),
];
export const verifyCode: RequestHandler[] = [
	body('email')
		.trim()
		.toLowerCase()
		.isEmail()
		.withMessage('The email address must be in the correct format.'),
	body('code')
		.trim()
		.isNumeric()
		.withMessage('The code must be numeric.')
		.bail()
		.isLength({
			min: 6,
			max: 6,
		})
		.withMessage('The code must be 6 length long.'),
	validationScheme,
	asyncHandler(async (req, res) => {
		const { email } = req.data;

		const rateLimiterRes =
			await limiterRequestResettingPasswordByEmail.get(email);

		if (!rateLimiterRes) {
			res.status(428).json({
				success: false,
				message: 'You have not applied to reset password.',
			});
			return;
		}

		if (rateLimiterRes.remainingPoints <= 0) {
			res
				.status(429)
				.set('Retry-After', rateLimiterRes.msBeforeNext.toString())
				.json({
					success: false,
					message: 'You have reset password too many times',
				});
			return;
		}

		try {
			await limiterVerifyCodeByEmail.consume(email);
		} catch (rejected) {
			if (rejected instanceof RateLimiterRes) {
				res.status(401).json({
					success: false,
					message: 'Code is invalid.',
				});
				return;
			} else {
				throw rejected;
			}
		}

		const codeDoc = await Code.findOne({ email }).exec();

		if (!codeDoc) {
			await limiterVerifyCodeByEmail.block(email, 0);
			res.status(401).json({
				success: false,
				message: 'Code is invalid.',
			});
			return;
		}

		if (!(await verify(codeDoc.code as string, req.body.code))) {
			res.status(401).json({
				success: false,
				message: 'Code is invalid.',
			});
			return;
		}

		const fifteenMins = 15 * 60 * 1000;

		req.session.cookie.maxAge = fifteenMins;
		req.session.email = email;

		await codeDoc.deleteOne();

		res
			.set('Expire-After', fifteenMins.toString())
			.set('Cache-Control', 'no-cache=Set-Cookie') // To avoid the private or sensitive data exchanged within the session through the web browser cache after the session has been closed.
			.cookie(
				process.env.NODE_ENV === 'production' ? '__Secure-token' : 'token',
				generateCSRFToken(req.sessionID),
				{
					sameSite: 'strict',
					httpOnly: false, // Front-end need to access __Secure-token cookie
					secure: process.env.NODE_ENV === 'production',
					domain: process.env.DOMAIN ?? '',
					maxAge: fifteenMins,
				},
			)
			.json({
				success: true,
				message: 'Verify code is successfully',
			});
	}),
];

export const requestResettingPassword: RequestHandler[] = [
	body('email')
		.trim()
		.toLowerCase()
		.isEmail()
		.withMessage('The email address must be in the correct format.'),
	validationScheme,
	asyncHandler(async (req, res) => {
		const { email } = req.data;

		try {
			await limiterRequestResettingPasswordByEmail.consume(email);
		} catch (rejected) {
			if (rejected instanceof RateLimiterRes) {
				res
					.status(429)
					.set('Retry-After', rejected.msBeforeNext.toString())
					.json({
						success: false,
						message: 'You have reset password too many times',
					});
			} else {
				throw rejected;
			}
		}

		const user = await User.findOne({ email }).exec();

		let emailTemplate = null;

		if (user) {
			const code = randomInt(100000, 999999).toString();

			const hashedCode = await hash(code, {
				type: argon2id,
				memoryCost: 47104,
				timeCost: 1,
				parallelism: 1,
			});

			const fiveMins = 5 * 60 * 1000;
			await Promise.all([
				Code.replaceOne(
					{ email },
					{
						user: user.id,
						code: hashedCode,
						email,
						expiresAfter: new Date(Date.now() + fiveMins),
					},
					{ upsert: true },
				),
				limiterVerifyCodeByEmail.delete(email),
			]);

			emailTemplate = mjml2html(
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
			                  We received a request to reset your password.
			                </mj-text>

			                <mj-divider border-width="1px" border-style="solid" border-color="lightgrey" />
			                <mj-text>
			                  Your Helog verification code is:

			                </mj-text>
			                <mj-text align="center" font-size="20px" letter-spacing="8px">
			                  ${code}
			                </mj-text>
			                <mj-text align="center" font-weight="bold">
			                  This code will expire in 5 minutes.
			                </mj-text>

			                <mj-divider border-width="1px" border-style="solid" border-color="lightgrey" />

			                <mj-text>
			                  This is an automated email. If you received it by mistake, you don't need to do anything.
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

			res.set('Expire-After', fiveMins.toString());
		} else {
			emailTemplate = mjml2html(
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
		                    We received a request recently made to reset your password with this email address, but there is no active account associated with the email address.
			                </mj-text>

			                <mj-divider border-width="1px" border-style="solid" border-color="lightgrey" />

			                <mj-text>
			                  This is an automated email. If you received it by mistake, you don't need to do anything.
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
		}

		await sendEmail({
			receiver: email,
			subject: 'Password reset request',
			html: emailTemplate.html,
		});

		res.json({
			success: true,
			message: 'The verification code is sending',
		});
	}),
];
export const resetPassword: RequestHandler[] = [
	(req, res, next) => {
		if (req.session.email) {
			next();
		} else {
			res.status(401).json({
				success: false,
				message: 'The credential is invalid.',
			});
		}
	},
	validationCSRF,
	body('password')
		.isLength({ min: 8, max: 64 })
		.withMessage(
			'The password length must be greater than 8 characters or you can use passphrases less than 64 characters.',
		),
	validationScheme,
	asyncHandler(async (req, res, next) => {
		const { email } = req.session;
		const rateLimiterRes = await limiterRequestResettingPasswordByEmail.get(
			email as string,
		);

		if (!rateLimiterRes) {
			res.status(428).json({
				success: false,
				message: 'You have not applied to reset password.',
			});
			return;
		}

		if (rateLimiterRes.remainingPoints <= 0) {
			res
				.status(429)
				.set('Retry-After', rateLimiterRes.msBeforeNext.toString())
				.json({
					success: false,
					message: 'You have reset password too many times',
				});
			return;
		}

		const hashedPassword = await hash(req.data.password, {
			type: argon2id,
			memoryCost: 47104,
			timeCost: 1,
			parallelism: 1,
		});
		const user = await User.findOneAndUpdate(
			{ email },
			{
				password: hashedPassword,
			},
		);

		if (!user) {
			throw new Error('User is not found.');
		}

		req.session.destroy(async error => {
			if (error) {
				next(error);
			} else {
				const emailTemplate = mjml2html(
					`
				  <mjml>
				    <mj-body>
				      <mj-section background-color="#26ACA3">
				        <mj-column>
				          <mj-text font-style="italic" font-size="20px" font-family="Helvetica Neue" color="#ffffff">
				            Helog Password Reset Informing
				          </mj-text>
				        </mj-column>
				      </mj-section>

				      <mj-section background-color="#F5F8FE">
				        <mj-column>
				          <mj-text>
				            Dear Helog User,
				          </mj-text>

				          <mj-text>
				            We have been reset your password.
				          </mj-text>

				          <mj-text>
				            Please use your new password to login your account.
				          </mj-text>

				          <mj-divider border-width="1px" border-style="solid" border-color="lightgrey" />

				          <mj-text>
				            This is an automated email. If you received it by mistake, you don't need to do anything.
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

				const Sessions = await mongoose.connection.collection('sessions');

				await Promise.all([
					Sessions.deleteMany({
						'session.passport.user.id': user.id,
					}),
					sendEmail({
						receiver: user.email as string,
						subject: 'Your password has been reset',
						html: emailTemplate.html,
					}),
				]);

				res
					.clearCookie(
						process.env.NODE_ENV === 'production' ? '__Secure-token' : 'token',
						{ domain: process.env.DOMAIN ?? '' },
					)
					.clearCookie(
						process.env.NODE_ENV === 'production' ? '__Secure-id' : 'id',
						{
							domain: process.env.DOMAIN ?? '',
						},
					)
					.json({
						success: true,
						message: 'Resetting user password is successfully',
					});
			}
		});
	}),
];
