import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';

import { User } from '../models/user.js';

passport.use(
	new LocalStrategy(
		{
			usernameField: 'email',
		},
		async (email, _password, done) => {
			const user = await User.findOne({
				email,
			}).exec();

			done(null, user ? { id: user.id } : undefined);
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
