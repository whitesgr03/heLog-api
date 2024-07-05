import asyncHandler from "express-async-handler";

import { validationResult, checkSchema, matchedData } from "express-validator";

const verifyFormSchema = schema => {
	return asyncHandler(async (req, res, next) => {
		await checkSchema(schema, ["body"]).run(req);

		const schemaErrors = validationResult(req);

		const handleSchemaErrors = () => {
			const inputErrors = schemaErrors.mapped();

			res.render(req.path.split("/")[1], {
				user: { ...req.body },
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
