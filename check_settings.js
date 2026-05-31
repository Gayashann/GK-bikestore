const mongoose = require('mongoose');
const dotenv = require('dotenv');
const AdminSetting = require('./models/AdminSetting');

dotenv.config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Successfully connected to DB.');
    const settings = await AdminSetting.find({});
    console.log('All Database Settings:');
    settings.forEach(s => {
      console.log(`Key: ${s.key}, Value: ${s.value}`);
    });
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('Error:', err);
  });
