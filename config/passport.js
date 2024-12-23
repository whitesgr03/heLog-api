import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";

import User from "../models/user.js";
passport.use(
	new GoogleStrategy(
		{
			clientID: process.env.GOOGLE_CLIENT_ID,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET,
			callbackURL: `${process.env.HELOG_API_URL}/account/oauth2/redirect/google`,
			scope: ["profile", "email"],
			state: true,
		},
		async (_accessToken, _refreshToken, profile, done) => {
			const credential = await FederatedCredential.findOne({
				provider: "https://accounts.google.com",
				subject: profile.id,
			})
				.populate("user", { isAdmin: 1 })
				.exec();

			const handleRegister = async () => {
				const currentTime = new Date();
				const newUser = new User({
					email: profile.emails[0].value,
					name: profile.displayName,
					isAdmin: process.env.NODE_ENV === "development",
					lastModified: currentTime,
					createdAt: currentTime,
				});

				const newCredential = new FederatedCredential({
					user: newUser._id,
					provider: "https://accounts.google.com",
					subject: profile.id,
				});

				await newUser.save();
				await newCredential.save();

				return done(null, {
					_id: newUser._id,
					isAdmin: newUser.isAdmin,
				});
			};

			credential ? done(null, credential.user) : await handleRegister();
		}
	)
);
passport.use(
	new FacebookStrategy(
		{
			clientID: process.env.FACEBOOK_CLIENT_ID,
			clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
			callbackURL: `${process.env.HELOG_API_URL}/account/oauth2/redirect/facebook`,
			profileFields: ["id", "displayName", "photos", "email"],
			enableProof: true,
			state: true,
		},
		async (_accessToken, _refreshToken, profile, done) => {
			const credential = await FederatedCredential.findOne({
				provider: "https://www.facebook.com",
				subject: profile.id,
			})
				.populate("user", { isAdmin: 1 })
				.exec();

			const handleRegister = async () => {
				const currentTime = new Date();
				const newUser = new User({
					email: profile.emails[0].value,
					name: profile.displayName,
					isAdmin: process.env.NODE_ENV === "development",
					lastModified: currentTime,
					createdAt: currentTime,
				});

				const newCredential = new FederatedCredential({
					user: newUser._id,
					provider: "https://www.facebook.com",
					subject: profile.id,
				});

				await newUser.save();
				await newCredential.save();

				return done(null, {
					_id: newUser._id,
					isAdmin: newUser.isAdmin,
				});
			};

			credential ? done(null, credential.user) : await handleRegister();
		}
	)
);

passport.serializeUser((user, done) => {
	done(null, user);
});

passport.deserializeUser((user, done) => {
	done(null, user);
});

export default passport;
