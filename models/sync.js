const sequelize = require('./index');
require('./owner');
require('./inventory_item');
require('./sale');
require('./sale_item');
require('./income_summary');

(async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('All models were synchronized successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error syncing models:', error);
    process.exit(1);
  }
})();
