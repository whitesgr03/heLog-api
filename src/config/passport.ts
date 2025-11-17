import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Types } from 'mongoose';

import { Federated } from '../models/federated.js';
import { User } from '../models/user.js';
import { UserDocument } from '../models/user.js';

declare global {
	namespace Express {
		interface User {
			id: Types.ObjectId;
		}
	}
}

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
						username: profile.displayName,
						isAdmin: process.env.NODE_ENV === 'development',
					});
					await newUser.save();
					const newFederated = new Federated({
						user: newUser.id,
						provider: profile.provider,
						subject: profile.id,
					});
					await newFederated.save();
					done(null, { id: newUser.id });
				};

				federated?.user
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
						username: profile.displayName,
						isAdmin: process.env.NODE_ENV === 'development',
					});
					await newUser.save();
					const newFederated = new Federated({
						user: newUser.id,
						provider: profile.provider,
						subject: profile.id,
					});
					await newFederated.save();
					done(null, { id: newUser.id });
				};

				federated?.user
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
