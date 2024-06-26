import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import debug from "debug";

import User from "../models/user.js";

const errorLog = debug("AuthenticateError");

passport.use(
	new LocalStrategy(
		{ usernameField: "email" },
		async (email, password, done) => {
			try {
				const user = await User.findOne({ email });
				const match =
					user && (await bcrypt.compare(password, user.password));

				match
					? done(null, user.id)
					: done(null, false, "The account could not be found.");
			} catch (err) {
				done(err);
			}
		}
	)
);

passport.serializeUser((id, done) => {
	done(null, id);
});

passport.deserializeUser(async (id, done) => {
	const user = await User.findById(id).catch(err => {
		errorLog(`deserializeUser ${err.name}: ${err.message}`);
		done(null, false);
	});
	done(null, user);
});

export default passport;
