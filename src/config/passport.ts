import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as LocalStrategy } from 'passport-local';
import { verify } from 'argon2';
import { randomUUID } from 'node:crypto';

import { Federated } from '../models/federated.js';
import { User } from '../models/user.js';
import { UserDocument } from '../models/user.js';

passport.use(
	new LocalStrategy(
		{
			usernameField: 'email',
		},
		async (email, password, done) => {
			try {
				const user = await User.findOne({ email });

				if (user && (await verify(user.password as string, password))) {
					return done(null, { id: user.id });
				}

				done(null, false);
			} catch (error) {
				done(error);
			}
		},
	),
);
passport.use(
	new GoogleStrategy(
		{
			clientID: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
			callbackURL: `${process.env.HELOG_API_URL}/account/oauth2/redirect/google`,
			scope: ['profile'],
		},
		async (_accessToken, _refreshToken, profile, done) => {
			try {
				const federated = await Federated.findOne({
					provider: profile.provider,
					subject: profile.id,
				})
					.populate<{ user: UserDocument }>('user', {
						username: 1,
					})
					.exec();

				const handleRegistration = async () => {
					const newUser = new User({
						username: `user-${randomUUID()}`,
						isAdmin: process.env.NODE_ENV === 'development',
					});

					const newFederated = new Federated({
						user: newUser.id,
						provider: profile.provider,
						subject: profile.id,
					});

					await Promise.all([newUser.save(), newFederated.save()]);
					done(null, { id: newUser.id });
				};

				federated
					? done(null, {
							id: federated.user.id,
						})
					: await handleRegistration();
			} catch (error) {
				done(error);
			}
		},
	),
);
passport.use(
	new FacebookStrategy(
		{
			clientID: process.env.FACEBOOK_CLIENT_ID!,
			clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
			callbackURL: `${process.env.HELOG_API_URL}/account/oauth2/redirect/facebook`,
			profileFields: ['id', 'displayName'],
			enableProof: true,
		},
		async (_accessToken, _refreshToken, profile, done) => {
			try {
				const federated = await Federated.findOne({
					provider: profile.provider,
					subject: profile.id,
				})
					.populate<{ user: UserDocument }>('user', {
						username: 1,
					})
					.exec();

				const handleRegistration = async () => {
					const newUser = new User({
						username: `user-${randomUUID()}`,
						isAdmin: process.env.NODE_ENV === 'development',
					});

					const newFederated = new Federated({
						user: newUser.id,
						provider: profile.provider,
						subject: profile.id,
					});

					await Promise.all([newUser.save(), newFederated.save()]);
					done(null, { id: newUser.id });
				};

				federated
					? done(null, {
							id: federated.user.id,
						})
					: await handleRegistration();
			} catch (error) {
				done(error);
			}
		},
	),
);

passport.serializeUser((user, done) => {
	done(null, user);
});
passport.deserializeUser((user: Express.User, done) => {
	done(null, user);
});

export { passport };
