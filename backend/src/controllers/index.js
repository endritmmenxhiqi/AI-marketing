const authController = require('./authController');
const aiController = require('./aiController');
const generationController = require('./generationController');

module.exports = {
  ...authController,
  ...aiController,
  ...generationController,
};
