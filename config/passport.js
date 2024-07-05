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
				const user = await User.findOne({ email }, { password: 1 });
				const match =
					user && (await bcrypt.compare(password, user.password));

				match
					? done(null, user)
					: done(null, false, "The account could not be found.");
			} catch (err) {
				done(err);
			}
		}
	)
);

passport.serializeUser((user, done) => {
	done(null, user);
});

passport.deserializeUser(async (id, done) => {
	const user = await User.findById(id, { isAdmin: 1 }).catch(err => {
		errorLog(`deserializeUser ${err.name}: ${err.message}`);
		done(null, false);
	});
	done(null, user);
});

export default passport;
