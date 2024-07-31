import asyncHandler from "express-async-handler";

import { validationResult, checkSchema, matchedData } from "express-validator";

const verifyFormSchema = schema => {
	return asyncHandler(async (req, res, next) => {
		await checkSchema(schema, ["body"]).run(req);

		const schemaErrors = validationResult(req);

		const handleSchemaErrors = () => {
			const inputErrors = schemaErrors.mapped();
			const {
				state,
				code_challenge,
				code_challenge_method,
				redirect_url,
				darkTheme,
			} = req.query;

			const queries =
				`state=${state}` +
				`&code_challenge=${code_challenge}` +
				`&code_challenge_method=${code_challenge_method}` +
				`&redirect_url=${redirect_url}` +
				`&darkTheme=${darkTheme}`;

			res.render(req.path.split("/")[1], {
				user: { ...req.body },
				queries,
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
