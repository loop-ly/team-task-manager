const Joi = require('joi');
const sanitizeHtml = require('sanitize-html');

/**
 * Removes any HTML from user text. React escapes output anyway; this is
 * defence in depth so stored data never contains markup.
 * sanitize-html entity-encodes "&", which we decode back for display.
 */
function stripHtml(value) {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).replace(/&amp;/g, '&').trim();
}

// stripHtml runs BEFORE the length rules so input like "<b></b>" cannot slip through as an empty value.
const text = (min, max) => Joi.string().custom(stripHtml).min(min).max(max);
const optionalText = (max) => Joi.string().custom(stripHtml).max(max).allow('');
const email = Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(255);
const id = Joi.number().integer().positive();

const STATUSES = ['todo', 'in_progress', 'done'];
const PRIORITIES = ['low', 'medium', 'high'];

// bcrypt only uses the first 72 bytes, so longer passwords are rejected outright.
const password = Joi.string()
  .min(8)
  .max(72)
  .pattern(/[A-Za-z]/, 'letter')
  .pattern(/\d/, 'number')
  .messages({
    'string.pattern.name': 'password must contain at least one letter and one number',
  });

module.exports = {
  STATUSES,
  PRIORITIES,

  idParam: Joi.object({ id: id.required() }),
  memberParams: Joi.object({ id: id.required(), userId: id.required() }),
  inviteParams: Joi.object({ id: id.required(), inviteId: id.required() }),

  register: Joi.object({
    name: text(2, 80).required(),
    email: email.required(),
    password: password.required(),
  }),
  login: Joi.object({
    email: email.required(),
    password: Joi.string().max(72).required(),
  }),

  createTeam: Joi.object({
    name: text(2, 100).required(),
    description: optionalText(500).default(''),
  }),
  updateTeam: Joi.object({
    name: text(2, 100),
    description: optionalText(500),
  }).min(1),
  emailBody: Joi.object({ email: email.required() }),

  createTask: Joi.object({
    teamId: id.required(),
    title: text(1, 200).required(),
    description: optionalText(2000).default(''),
    status: Joi.string().valid(...STATUSES).default('todo'),
    priority: Joi.string().valid(...PRIORITIES).default('medium'),
    dueDate: Joi.date().iso().raw().allow(null).default(null),
    assigneeId: id.allow(null).default(null),
  }),
  // teamId is deliberately absent: tasks cannot be moved between teams.
  updateTask: Joi.object({
    title: text(1, 200),
    description: optionalText(2000),
    status: Joi.string().valid(...STATUSES),
    priority: Joi.string().valid(...PRIORITIES),
    dueDate: Joi.date().iso().raw().allow(null),
    assigneeId: id.allow(null),
  }).min(1),
  listTasks: Joi.object({
    teamId: id,
    // a user id, "me", or "unassigned"
    assignee: Joi.alternatives().try(id, Joi.string().valid('me', 'unassigned')),
    status: Joi.string().valid(...STATUSES),
    priority: Joi.string().valid(...PRIORITIES),
    search: Joi.string().trim().max(100).allow(''),
    sort: Joi.string().valid('dueDate', 'createdAt', 'priority').default('createdAt'),
  }),
};
