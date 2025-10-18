'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date();

    const categories = ['Pain Relief', 'Antibiotics', 'Vitamins', 'Cough & Cold', 'Digestive', 'Skin Care', 'Eye Care', 'Cardiovascular', 'Diabetes', 'Respiratory'];

    const names = [
      'Paracetamol 500mg', 'Ibuprofen 400mg', 'Amoxicillin 250mg', 'Vitamin C 1000mg', 'Cough Syrup',
      'Aspirin 75mg', 'Omeprazole 20mg', 'Simvastatin 10mg', 'Metformin 500mg', 'Salbutamol Inhaler',
      'Loratadine 10mg', 'Cetirizine 10mg', 'Fexofenadine 180mg', 'Diphenhydramine 25mg', 'Codeine Phosphate 30mg',
      'Tramadol 50mg', 'Morphine Sulfate 10mg', 'Diazepam 5mg', 'Alprazolam 0.5mg', 'Fluoxetine 20mg',
      'Sertraline 50mg', 'Amitriptyline 25mg', 'Citalopram 20mg', 'Paroxetine 20mg', 'Escitalopram 10mg',
      'Venlafaxine 75mg', 'Duloxetine 30mg', 'Bupropion 150mg', 'Methylphenidate 10mg', 'Amphetamine 5mg',
      'Clonazepam 0.5mg', 'Lorazepam 1mg', 'Temazepam 10mg', 'Zolpidem 10mg', 'Zopiclone 7.5mg',
      'Buspirone 10mg', 'Hydroxyzine 25mg', 'Chlorpromazine 25mg', 'Haloperidol 1.5mg', 'Risperidone 1mg',
      'Olanzapine 5mg', 'Quetiapine 25mg', 'Aripiprazole 10mg', 'Lithium Carbonate 400mg', 'Carbamazepine 200mg',
      'Valproate 500mg', 'Lamotrigine 25mg', 'Gabapentin 300mg', 'Pregabalin 75mg', 'Topiramate 25mg'
    ];

    const suppliers = ['Supplier A', 'Supplier B', 'Supplier C'];

    const inventoryData = names.map((name, index) => {
      const unit_price = Math.floor(Math.random() * 4900) + 100;
      return {
        name,
        description: `Sample description for ${name}`,
        owner_id: (index % 2) + 1,
        category: categories[index % categories.length],
        unit_type: 'pieces',
        quantity: Math.floor(Math.random() * 150) + 50,
        unit_price,
        selling_price: unit_price * 2,
        minimum_stock: Math.floor(Math.random() * 40) + 10,
        barcode: `BAR${index + 1}`,
        expiry_date: new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000 * 2),
        supplier: suppliers[index % suppliers.length],
        is_active: true,
        created_at: now,
        updated_at: now,
      };
    });

    const inventoryRecords = await queryInterface.bulkInsert('inventory_items', inventoryData, { returning: true });

    // Generate sales dates: 4 per month for 12 months (48), plus 2 more
    const salesDates = [];
    for (let month = 0; month < 12; month++) {
      salesDates.push(new Date(2024, month, 5));
      salesDates.push(new Date(2024, month, 15));
      salesDates.push(new Date(2024, month, 25));
      salesDates.push(new Date(2024, month, 28));
    }
    salesDates.push(new Date(2025, 0, 5));
    salesDates.push(new Date(2025, 0, 15));

    const salesData = salesDates.map(date => ({
      sale_date: date,
      total_amount: 0, // will update later
      payment_method: Math.random() > 0.5 ? 'cash' : 'mobile',
      customer_name: `Customer ${Math.floor(Math.random() * 1000) + 1}`,
      customer_phone: `+959${Math.floor(Math.random() * 900000000) + 100000000}`,
      notes: '',
      created_at: now,
      updated_at: now,
    }));

    const salesRecords = await queryInterface.bulkInsert('sales', salesData, { returning: true });

    const saleItemsData = [];
    for (let i = 0; i < salesRecords.length; i++) {
      const sale = salesRecords[i];
      const numItems = Math.floor(Math.random() * 3) + 1;
      let total = 0;
      for (let j = 0; j < numItems; j++) {
        const item = inventoryRecords[Math.floor(Math.random() * inventoryRecords.length)];
        const quantity = Math.floor(Math.random() * 5) + 1;
        const unit_price = item.selling_price;
        const total_price = quantity * unit_price;
        total += total_price;
        saleItemsData.push({
          sale_id: sale.id,
          inventory_item_id: item.id,
          quantity,
          unit_price,
          total_price,
          owner_id: item.owner_id,
          created_at: now,
          updated_at: now,
        });
      }
      // Update total_amount
      await queryInterface.sequelize.query(`UPDATE sales SET total_amount = ? WHERE id = ?`, {
        replacements: [total, sale.id]
      });
    }

    await queryInterface.bulkInsert('sale_items', saleItemsData);

    // Calculate income summaries
    const inventoryMap = new Map();
    inventoryRecords.forEach(item => inventoryMap.set(item.id, item));

    const summaries = new Map();
    saleItemsData.forEach(item => {
      const sale = salesRecords.find(s => s.id === item.sale_id);
      const dateStr = sale.sale_date.toISOString().split('T')[0];
      const key = `${item.owner_id}-${dateStr}`;
      if (!summaries.has(key)) {
        summaries.set(key, {
          owner_id: item.owner_id,
          date: dateStr,
          total_sales: 0,
          total_profit: 0,
          total_items_sold: 0,
        });
      }
      const summary = summaries.get(key);
      summary.total_sales += parseFloat(item.total_price);
      const invItem = inventoryMap.get(item.inventory_item_id);
      const profit = (parseFloat(item.unit_price) - parseFloat(invItem.unit_price)) * item.quantity;
      summary.total_profit += profit;
      summary.total_items_sold += item.quantity;
    });

    const incomeSummaryData = Array.from(summaries.values()).map(s => ({
      ...s,
      created_at: now,
      updated_at: now,
    }));

    await queryInterface.bulkInsert('income_summary', incomeSummaryData);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('income_summary', null, {});
    await queryInterface.bulkDelete('sale_items', null, {});
    await queryInterface.bulkDelete('sales', null, {});
    await queryInterface.bulkDelete('inventory_items', null, {});
  },
};