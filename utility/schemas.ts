import Joi from 'joi';

// Register schema
export const RegisterSchema = Joi.object({
	username: Joi
		.string().alphanum().required().label('Username')
		.min(4).max(64),
	password: Joi
		.string().alphanum().required().label('Password')
		.min(6).max(128),
	email: Joi
		.string().email({
			tlds: {
				allow: false,
			}
		}).required().label('Email')
		.max(512),
})

// Log In schema
export const LogInSchema = Joi.object({
	username: Joi
		.string().alphanum().required().label('Username')
		.min(4).max(64),
	password: Joi
		.string().alphanum().required().label('Password')
		.min(6).max(128),
})
