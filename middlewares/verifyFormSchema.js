import asyncHandler from "express-async-handler";
import { validationResult, checkSchema, matchedData } from "express-validator";
import Csrf from "csrf";

const verifyFormSchema = schema => {
	return asyncHandler(async (req, res, next) => {
		await checkSchema(schema, ["body"]).run(req);

		const schemaErrors = validationResult(req);

		const handleSchemaErrors = async () => {
			const inputErrors = schemaErrors.mapped();

			const csrf = new Csrf();
			const secret = await csrf.secret();
			req.session.csrf = secret;

			res.render(req.path.split("/")[1], {
				user: { ...req.body },
				csrfToken: csrf.create(secret),
				inputErrors,
			});
		};

		const setMatchData = () => {
			req.data = matchedData(req);
			next();
		};

		schemaErrors.isEmpty() ? setMatchData() : handleSchemaErrors();
	});
};

export default verifyFormSchema;
