import { RequestHandler } from 'express';
import { validationResult, matchedData } from 'express-validator';

export const validationScheme: RequestHandler = (req, res, next) => {
	const schemaErrors = validationResult(req);

	const handleSchemaErrors = () => {
		const errors = schemaErrors.mapped();

		res.status(400).json({
			success: false,
			fields: Object.keys(errors).reduce(
				(obj: any, error: any) =>
					Object.assign(obj, { [error]: errors[error]['msg'] }),
				{},
			),
		});
	};

	const setMatchData = () => {
		req.data = matchedData(req);
		next();
	};

	schemaErrors.isEmpty() ? setMatchData() : handleSchemaErrors();
};
