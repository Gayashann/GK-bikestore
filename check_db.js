const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Bike = require('./models/Bike');

dotenv.config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Successfully connected to DB.');
    const countAll = await Bike.countDocuments({});
    const countAvailable = await Bike.countDocuments({ status: 'Available' });
    const countSold = await Bike.countDocuments({ status: 'Sold' });
    const allBikes = await Bike.find({});
    
    console.log(`Total Bikes: ${countAll}`);
    console.log(`Available: ${countAvailable}`);
    console.log(`Sold: ${countSold}`);
    console.log('All Bikes Details:', allBikes.map(b => ({ brand: b.brand, model: b.model, status: b.status, numberPlate: b.numberPlate })));
    
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('Error connecting to DB:', err);
  });
