const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Bike = require('./models/Bike');

dotenv.config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Successfully connected to DB.');
    
    // Check if FZ v2 already exists to prevent duplicate
    const exists = await Bike.findOne({ numberPlate: 'BGC 1235' });
    if (exists) {
      console.log('FZ v2 already exists in database.');
    } else {
      const mockBike = new Bike({
        brand: 'Yamaha',
        model: 'FZ v2',
        numberPlate: 'BGC 1235',
        buyingPrice: 750000,
        status: 'Available',
        purchaseDate: new Date(),
        image: 'sports' // Use the default sport bike SVGpreset
      });
      
      await mockBike.save();
      console.log('Mock bike FZ v2 successfully added to database!');
    }
    
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('Error connecting to DB:', err);
  });
