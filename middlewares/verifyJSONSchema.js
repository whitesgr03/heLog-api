import asyncHandler from "express-async-handler";

import { validationResult, checkSchema, matchedData } from "express-validator";

const verifyJSONSchema = schema => {
	return asyncHandler(async (req, res, next) => {
		await checkSchema(schema, ["body"]).run(req);

		const schemaErrors = validationResult(req);

		const handleSchemaErrors = () => {
			const inputErrors = schemaErrors.mapped();

			res.status(req.schema?.isConflict ? 409 : 400).json({
				success: false,
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

export default verifyJSONSchema;
