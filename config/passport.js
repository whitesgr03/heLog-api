import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";

import { User } from "../models/user.js";

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
			const user = await User.findOne({
				email: profile.emails[0].value,
			}).exec();

			const handleRegistration = async () => {
				const newUser = new User({
					email: profile.emails[0].value,
					provider: ["google"],
					isAdmin: process.env.NODE_ENV === "development",
				});

				await newUser.save();

				done(null, { id: newUser._id });
			};

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
			const user = await User.findOne({
				email: profile.emails[0].value,
			}).exec();

			const handleRegistration = async () => {
				const newUser = new User({
					email: profile.emails[0].value,
					provider: ["facebook"],
					isAdmin: process.env.NODE_ENV === "development",
				});

				await newUser.save();

				done(null, { id: newUser._id });
			};
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
