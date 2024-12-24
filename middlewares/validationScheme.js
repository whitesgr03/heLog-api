import { validationResult, matchedData } from "express-validator";

export const validationScheme = (req, res, next) => {
	const schemaErrors = validationResult(req);

	const handleSchemaErrors = () => {
		const errors = schemaErrors.mapped();

		let fields = {};

		for (const key of Object.keys(errors)) {
			fields[key] = errors[key]["msg"];
		}

		res.status(400).json({
			success: false,
			fields,
		});
	};

	const setMatchData = () => {
		req.data = matchedData(req);
		next();
	};

	schemaErrors.isEmpty() ? setMatchData() : handleSchemaErrors();
};
