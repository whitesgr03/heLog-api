import express from 'express';

import * as accountControllers from '../controllers/accountController.js';
import { isLogin } from '../middlewares/authenticate.js';

export const accountRouter = express.Router();

accountRouter.post('/logout', accountControllers.userLogout);

accountRouter.use(isLogin);

accountRouter.post('/login', accountControllers.login);
accountRouter.post('/register', accountControllers.register);
accountRouter.post('/verify/email', accountControllers.validationEmail);

accountRouter.get('/login/google', accountControllers.googleLogin);
accountRouter.get('/oauth2/redirect/google', accountControllers.googleRedirect);

accountRouter.get('/login/facebook', accountControllers.facebookLogin);
accountRouter.get(
	'/oauth2/redirect/facebook',
	accountControllers.facebookRedirect,
);
