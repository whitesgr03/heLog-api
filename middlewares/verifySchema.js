import asyncHandler from "express-async-handler";

import { validationResult, checkSchema, matchedData } from "express-validator";

const verifySchema = schema => {
	return asyncHandler(async (req, res, next) => {
		await checkSchema(schema, ["body"]).run(req);

		const schemaErrors = validationResult(req);

		const handleSchemaErrorMessages = () => {
			const path = req.originalUrl.split("/")[2];
			// const errors = schemaErrors.array().map(error => ({
			// 	field: error.path,
			// 	message: error.msg,
			// }));
			const inputErrors = schemaErrors.mapped();

			path && (path === "login" || path === "register")
				? res.render(path, {
						user: { ...req.body },
						inputErrors,
				  })
				: res.status(req.schema?.isConflict ? 409 : 400).json({
						success: false,
						inputErrors,
				  });
		};

		const setMatchedData = () => {
			req.data = matchedData(req);
			next();
		};
		schemaErrors.isEmpty() ? setMatchedData() : handleSchemaErrorMessages();
	});
};

export default verifySchema;
