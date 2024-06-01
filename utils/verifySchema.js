const asyncHandler = require("express-async-handler");
const {
	validationResult,
	checkSchema,
	matchedData,
} = require("express-validator");

const verifySchema = schema => {
	return asyncHandler(async (req, res, next) => {
		await checkSchema(schema, ["body"]).run(req);

		const schemaErrors = validationResult(req);

		const handleSchemaErrorMessages = () => {
			const errors = schemaErrors.array().map(error => ({
				field: error.path,
				message: error.msg,
			}));

			res.status(req.schema?.isConflict ? 409 : 400).json({
				success: false,
				errors,
			});
		};

		const setMatchedData = () => {
			req.data = matchedData(req);
			next();
		};
		schemaErrors.isEmpty() ? setMatchedData() : handleSchemaErrorMessages();
	});
};

module.exports = verifySchema;
