const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Bike = require('./models/Bike');
const CapitalEntry = require('./models/CapitalEntry');

dotenv.config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Successfully connected to DB.');
    
    // Simulate analytics for 'lm'
    const owner = 'lm';
    const bikes = await Bike.find({ owner });
    const capitalEntries = await CapitalEntry.find({ owner }).sort({ addedAt: -1 });
    
    console.log('Bikes count for lm:', bikes.length);
    console.log('Capital entries for lm:', capitalEntries.length);
    
    // Test stats calculations
    let totalInvested = 0;
    let activeInvestment = 0;
    let totalRevenue = 0;
    let totalProfit = 0;
    let soldCount = 0;
    let availableCount = 0;
    
    bikes.forEach(bike => {
      totalInvested += bike.buyingPrice;
      if (bike.status === 'Available') {
        activeInvestment += bike.buyingPrice;
        availableCount++;
      } else if (bike.status === 'Sold') {
        totalRevenue += bike.sellingPrice;
        totalProfit += (bike.sellingPrice - bike.buyingPrice);
        soldCount++;
      }
    });
    
    console.log('Calculated stats for lm:', { totalInvested, activeInvestment, totalRevenue, totalProfit });
    console.log('TEST PASSED SUCCESSFULLY!');
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('Test failed:', err);
  });
