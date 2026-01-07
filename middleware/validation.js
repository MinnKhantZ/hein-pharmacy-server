const Joi = require('joi');

const validateOwnerRegistration = (req, res, next) => {
  const schema = Joi.object({
    username: Joi.string().alphanum().min(3).max(50).required(),
    password: Joi.string().min(6).required(),
    full_name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().optional(),
    phone: Joi.string().pattern(/^[+]?[\s\d()-]+$/).optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

const validateOwnerLogin = (req, res, next) => {
  const schema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

const validateInventoryItem = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().min(1).max(200).required(),
    description: Joi.string().optional().allow('', null),
    category: Joi.string().max(100).optional().allow('', null),
    unit: Joi.string().max(50).optional().allow('', null),
    unit_type: Joi.string().max(50).optional(),
    quantity: Joi.number().integer().min(0).required(),
    unit_price: Joi.number().positive().required(),
    selling_price: Joi.number().positive().required(),
    minimum_stock: Joi.number().integer().min(0).optional(),
    barcode: Joi.string().max(100).optional(),
    expiry_date: Joi.date().optional(),
    supplier: Joi.string().max(200).optional(),
    owner_id: Joi.number().integer().positive().optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

const validateSale = (req, res, next) => {
  const schema = Joi.object({
    items: Joi.array().items(
      Joi.object({
        inventory_item_id: Joi.number().integer().positive().required(),
        quantity: Joi.number().integer().positive().required()
      })
    ).min(1).required(),
    payment_method: Joi.string().valid('cash', 'mobile', 'credit').optional(),
    customer_name: Joi.string().max(100).optional(),
    customer_phone: Joi.string().max(20).optional(),
    notes: Joi.string().optional(),
    device_push_token: Joi.string().optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

module.exports = {
  validateOwnerRegistration,
  validateOwnerLogin,
  validateInventoryItem,
  validateSale
};