import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { Types } from "mongoose";

import { User } from "../models/user.js";

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
			scope: ["email"],
		},
		async (_accessToken, _refreshToken, profile, done) => {
			const userEmail =
				Array.isArray(profile.emails) && profile.emails[0].value;

			const user = await User.findOne({
				email: userEmail,
			}).exec();

			const handleRegistration = async () => {
				const newUser = new User({
					email: userEmail,
					provider: ["google"],
					isAdmin: process.env.NODE_ENV === "development",
				});

				newUser.username = `User-${String(newUser._id).slice(-5)}`;

				await newUser.save();

				done(null, { id: newUser.id });
			};

			const handleUpdate = async () => {
				user?.provider.push("google");
				await user?.save();
				done(null, { id: user?.id });
			};

			user
				? user.provider.includes("google")
					? done(null, { id: user.id })
					: await handleUpdate()
				: await handleRegistration();
		}
	)
);
passport.use(
	new FacebookStrategy(
		{
			clientID: process.env.FACEBOOK_CLIENT_ID!,
			clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
			callbackURL: `${process.env.HELOG_API_URL}/account/oauth2/redirect/facebook`,
			profileFields: ["email"],
			enableProof: true,
		},
		async (_accessToken, _refreshToken, profile, done) => {
			const userEmail =
				Array.isArray(profile.emails) && profile.emails[0].value;

			const user = await User.findOne({
				email: userEmail,
			}).exec();

			const handleRegistration = async () => {
				const newUser = new User({
					email: userEmail,
					provider: ["facebook"],
					isAdmin: process.env.NODE_ENV === "development",
				});

				newUser.username = `User-${String(newUser._id).slice(-5)}`;

				await newUser.save();

				done(null, { id: newUser.id });
			};

			const handleUpdate = async () => {
				user?.provider.push("facebook");
				await user?.save();
				done(null, { id: user?.id });
			};

			user
				? user.provider.includes("facebook")
					? done(null, { id: user.id })
					: await handleUpdate()
				: await handleRegistration();
		}
	)
);

passport.serializeUser((user, done) => {
	done(null, user);
});
passport.deserializeUser((user: Express.User, done) => {
	done(null, user);
});

export { passport };
