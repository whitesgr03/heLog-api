import express from 'express';

import * as accountControllers from '../controllers/accountController.js';
import { isLogin } from '../middlewares/authenticate.js';

export const accountRouter = express.Router();

accountRouter.post('/logout', accountControllers.userLogout);

accountRouter.use(isLogin);

accountRouter.post('/login', accountControllers.login);
accountRouter.post('/requestRegister', accountControllers.requestRegistration);
accountRouter.post('/register', accountControllers.register);

accountRouter.post(
	'/requestResetPassword',
	accountControllers.requestResettingPassword,
);
accountRouter.post('/resetPassword', accountControllers.resetPassword);

accountRouter.post('/verifyCode', accountControllers.verifyCode);
accountRouter.post(
	'/requestVerificationCode',
	accountControllers.requestVerificationCode,
);

accountRouter.get('/login/:federation', accountControllers.federatedLogin);
accountRouter.get(
	'/oauth2/redirect/:federation',
	accountControllers.federatedRedirect,
);
