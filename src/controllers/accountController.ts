import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import passport, { AuthenticateCallback } from 'passport';
import { body } from 'express-validator';
import { hash, verify, argon2id } from 'argon2';
import { randomInt } from 'node:crypto';
import mjml2html from 'mjml';

import { authenticate } from '../middlewares/authenticate.js';
import { validationCSRF } from '../middlewares/validationCSRF.js';
import { validationScheme } from '../middlewares/validationScheme.js';
import { generateCSRFToken } from '../utils/generateCSRFToken.js';
import { User, UserDocument } from '../models/user.js';
import { Code } from '../models/code.js';

import { sendEmail } from '../utils/sendEmail.js';

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

export const login: RequestHandler[] = [
	body('email')
		.trim()
		.toLowerCase()
		.isEmail()
		.withMessage('Please enter a valid email address.'),
	body('password')
		.isLength({ min: 8, max: 64 })
		.withMessage(
			'The password length must be greater then 8 and less then 64 characters.',
		),
	validationScheme,
	(req, res, next) => {
		const authenticateCb: AuthenticateCallback = (err, user) => {
			err && next(err);
			user
				? req.login(user, () => {
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
							});
						// .redirect(process.env.HELOG_URL!);
					})
				: res.status(400).json({
						success: false,
						fields: {
							email: 'The email address was incorrect.',
							password: 'The password was incorrect.',
						},
					});
		};

		const authenticateFn = passport.authenticate('local', authenticateCb);
		authenticateFn(req, res, next);
	},
];
export const requestRegister: RequestHandler[] = [
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
			newUser: newUser.id,
			code: hashedCode,
			email,
			expiresAfter: new Date(fiveMins),
		});

		const codeDoc = await Code.findOne({ email }).exec();

		if (codeDoc) {
			await codeDoc.deleteOne().exec();
			if (codeDoc.newUser) {
				await User.findByIdAndDelete(codeDoc.newUser).exec();
			}
		}
		await Promise.all([newUser.save(), newCode.save()]);

		const { html } = mjml2html(
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

		await sendEmail({
			receiver: email,
			subject: 'Account Verification',
			html,
		});

		res.json({
			success: true,
			message: 'The verification code is sending',
		});
	}),
];

export const register: RequestHandler[] = [
	asyncHandler(async (req, res) => {
		const codeDoc = await Code.findOne({ email: req.body.email })
			.populate<{ newUser: UserDocument }>('newUser')
			.exec();

		if (codeDoc?.verify) {
			if (!(await User.findOne({ email: req.body.email }).exec())) {
				await codeDoc.newUser.updateOne({
					email: codeDoc.email,
					$unset: { expiresAfter: '' },
				});
				await codeDoc.deleteOne().exec();
				res.json({
					success: true,
					message: 'Account valid is successfully.',
				});
			} else {
				await Promise.all([codeDoc.deleteOne(), codeDoc.newUser.deleteOne()]);
				res.status(400).json({
					success: false,
					message: 'Account has already been registered.',
				});
			}
		} else {
			res.status(400).json({ success: false, message: 'Code is invalid.' });
		}
	}),
];

export const requestVerifyCode: RequestHandler[] = [
	asyncHandler(async (req, res) => {
		const codeDoc = await Code.findOne({ email: req.body.email })
			.populate<{ newUser: UserDocument }>('newUser')
			.exec();

		if (codeDoc) {
			const newCode = randomInt(100000, 999999).toString();

			const hashedCode = await hash(newCode, {
				type: argon2id,
				memoryCost: 47104,
				timeCost: 1,
				parallelism: 1,
			});

			const fiveMins = Date.now() + 5 * 60 * 1000;

			codeDoc.code = hashedCode;
			codeDoc.expiresAfter = new Date(fiveMins);

			await codeDoc.save();

			if (codeDoc.newUser) {
				codeDoc.newUser.expiresAfter = new Date(fiveMins);
				await codeDoc.newUser.save();
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
			            We received a request to
			            ${
										codeDoc.newUser
											? 'verify your email address.'
											: 'reset your password.'
									}
			            </mj-text>

			            <mj-divider border-width="1px" border-style="solid" border-color="lightgrey" />
			            <mj-text>
			              Your Helog verification code is:

			            </mj-text>
			            <mj-text align="center" font-size="20px">
			              ${newCode.split('').join(' ')}
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

			await sendEmail({
				receiver: req.body.email,
				subject: codeDoc.newUser ? 'Account Verification' : 'Password Reset',
				html: emailTemplate.html,
			});

			res.json({
				success: true,
				message: 'The verification code is sending',
			});
		} else {
			res
				.status(400)
				.json({ success: false, message: 'Code could not be found.' });
		}
	}),
];

export const verifyCode: RequestHandler[] = [
	asyncHandler(async (req, res) => {
		const codeDoc = await Code.findOne({ email: req.body.email }).exec();

		if (codeDoc) {
			if (await verify(codeDoc.code as string, req.body.code)) {
				codeDoc.verify = true;

				if (!codeDoc.newUser) {
					const tenMins = Date.now() + 10 * 60 * 1000;
					codeDoc.expiresAfter = new Date(tenMins);
				}

				await codeDoc.save();

				res.json({ success: true, message: 'Verify Code is successfully' });
			} else {
				codeDoc.failCount = codeDoc.failCount + 1;

				if (codeDoc.failCount === 3) {
					await codeDoc.deleteOne().exec();
					if (codeDoc.newUser) {
						await User.findByIdAndDelete(codeDoc.newUser).exec();
					}
				} else {
					await codeDoc.save();
				}

				res.status(400).json({
					success: false,
					message: 'Code is invalid.',
					data: { failCount: codeDoc.failCount },
				});
			}
		} else {
			res
				.status(400)
				.json({ success: false, message: 'Code could not be found.' });
		}
	}),
];

export const requestResetPassword: RequestHandler[] = [
	body('email')
		.trim()
		.toLowerCase()
		.isEmail()
		.withMessage('The email address must be in the correct format.'),
	validationScheme,
	asyncHandler(async (req, res) => {
		const { email } = req.data;

		const code = randomInt(100000, 999999).toString();

		const hashedCode = await hash(code, {
			type: argon2id,
			memoryCost: 47104,
			timeCost: 1,
			parallelism: 1,
		});

		const fiveMins = Date.now() + 5 * 60 * 1000;

		const newCode = new Code({
			code: hashedCode,
			email,
			expiresAfter: new Date(fiveMins),
		});

		await Code.findOneAndDelete({ email }).exec();
		await newCode.save();

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
		                <mj-text align="center" font-size="20px">
		                  ${code.split('').join(' ')}
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

		await sendEmail({
			receiver: email,
			subject: 'Password Reset',
			html: emailTemplate.html,
		});

		res.json({
			success: true,
			message: 'The verification code is sending',
		});
	}),
];
export const resetPassword: RequestHandler[] = [
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
		const codeDoc = await Code.findOne({ email: req.body.email }).exec();
		if (codeDoc?.verify) {
			const user = await User.findOne({ email: req.body.email }).exec();
			if (user) {
				const hashedPassword = await hash(req.data.password, {
					type: argon2id,
					memoryCost: 47104,
					timeCost: 1,
					parallelism: 1,
				});
				user.password = hashedPassword;

				await Promise.all([user.save(), codeDoc.deleteOne()]);

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

				await sendEmail({
					receiver: req.body.email,
					subject: 'Your Password has been reset',
					html: emailTemplate.html,
				});

				res.json({
					success: true,
					message: 'Resetting user password is successfully',
				});
			} else {
				await codeDoc.deleteOne();
				res.status(400).json({
					success: false,
					message: 'This account has not been registered.',
				});
			}
		} else {
			res.status(400).json({ success: false, message: 'Code is invalid.' });
		}
	}),
];
