const Joi = require('joi');

const validators = {
  consultarResolucion: Joi.object({
    nit: Joi.string().pattern(/^[0-9]+$/).required().messages({
      'string.pattern.base': 'El NIT debe contener solo números',
      'any.required': 'El NIT es obligatorio'
    }),
    softwareCode: Joi.string().uuid().required().messages({
      'string.uuid': 'El código de software debe ser un UUID válido',
      'any.required': 'El código de software es obligatorio'
    })
  }),

  consultarDocumento: Joi.object({
    tipo: Joi.string().valid('FACTURA', 'NOTA_CREDITO', 'DOCUMENTO_SOPORTE').required(),
    numero: Joi.string().required(),
    nit: Joi.string().required(),
    trackId: Joi.string().optional()
  }),

  crearUsuarioAdmin: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(8).required(),
    role: Joi.string().valid('ADMIN', 'OPERADOR').default('OPERADOR')
  })
};

module.exports = validators;