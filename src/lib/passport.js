import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";

import { User } from "../models/user";

passport.use(
	new LocalStrategy(
		{
			usernameField: "admin",
			passwordField: "_",
		},
		async (admin, _, done) => {
			const user = await User.findOne({
				isAdmin: admin === "1",
			}).exec();
			done(null, { id: user._id });
		}
	)
);

passport.serializeUser((user, done) => {
	done(null, user);
});

passport.deserializeUser((user, done) => {
	done(null, user);
});

export { passport };
