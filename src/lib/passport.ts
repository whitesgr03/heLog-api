import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';

import { User } from '../models/user.js';

passport.use(
	new LocalStrategy({}, async (username, _passport, done) => {
		const user = await User.findOne({
			username,
		}).exec();

		done(null, user ? { id: user.id } : undefined);
	}),
);

passport.serializeUser((user, done) => {
	done(null, user);
});

passport.deserializeUser((user: Express.User, done) => {
	done(null, user);
});

export { passport };
