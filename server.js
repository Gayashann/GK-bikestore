const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const Bike = require('./models/Bike');
const AdminSetting = require('./models/AdminSetting');
const CapitalEntry = require('./models/CapitalEntry');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow image uploads in base64
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection
let dbConnected = false;
let dbErrorMsg = '';

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB Atlas successfully.');
    dbConnected = true;
    try {
      const pwExists = await AdminSetting.findOne({ key: 'admin_password' });
      if (!pwExists) {
        await AdminSetting.create({ key: 'admin_password', value: 'gk2026' });
        console.log('🔑 Seeded default admin password (gk2026).');
      }
    } catch (err) {
      console.error('⚠️ Error seeding admin password:', err.message);
    }
  })
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err.message);
    dbErrorMsg = err.message;
    console.log('⚠️ Running in disconnected mode. Please configure MONGODB_URI in your .env file with your correct password.');
  });

// API Routes

// Health check / DB Status check
app.get('/api/status', (req, res) => {
  res.json({
    connected: dbConnected,
    error: dbConnected ? null : (dbErrorMsg || 'No database connection configured. Please update your .env file.')
  });
});

// GET all bikes (with filtering and search)
app.get('/api/bikes', async (req, res) => {
  if (!dbConnected) {
    return res.status(503).json({ error: 'Database not connected. Please check your .env configuration.' });
  }
  try {
    const { status, search } = req.query;
    let query = {};

    if (status && status !== 'All') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { brand: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
        { numberPlate: { $regex: search, $options: 'i' } }
      ];
    }

    const bikes = await Bike.find(query).sort({ createdAt: -1 });
    res.json(bikes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Add a new bike
app.post('/api/bikes', async (req, res) => {
  if (!dbConnected) {
    return res.status(503).json({ error: 'Database not connected. Please check your .env configuration.' });
  }
  try {
    const bikeData = req.body;
    // Set default purchase date if not provided
    if (!bikeData.purchaseDate) {
      bikeData.purchaseDate = new Date();
    }
    const newBike = new Bike(bikeData);
    await newBike.save();
    res.status(201).json(newBike);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT - Update a bike's details
app.put('/api/bikes/:id', async (req, res) => {
  if (!dbConnected) {
    return res.status(503).json({ error: 'Database not connected. Please check your .env configuration.' });
  }
  try {
    const updatedBike = await Bike.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updatedBike) {
      return res.status(404).json({ error: 'Bike not found' });
    }
    res.json(updatedBike);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH - Mark a bike as sold
app.patch('/api/bikes/:id/sell', async (req, res) => {
  if (!dbConnected) {
    return res.status(503).json({ error: 'Database not connected. Please check your .env configuration.' });
  }
  try {
    const { sellingPrice, saleDate } = req.body;
    if (!sellingPrice || sellingPrice <= 0) {
      return res.status(400).json({ error: 'Please provide a valid selling price.' });
    }

    const bike = await Bike.findById(req.params.id);
    if (!bike) {
      return res.status(404).json({ error: 'Bike not found' });
    }

    bike.status = 'Sold';
    bike.sellingPrice = sellingPrice;
    bike.saleDate = saleDate ? new Date(saleDate) : new Date();
    await bike.save();

    res.json(bike);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE - Delete a bike
app.delete('/api/bikes/:id', async (req, res) => {
  if (!dbConnected) {
    return res.status(503).json({ error: 'Database not connected. Please check your .env configuration.' });
  }
  try {
    const deletedBike = await Bike.findByIdAndDelete(req.params.id);
    if (!deletedBike) {
      return res.status(404).json({ error: 'Bike not found' });
    }
    res.json({ message: 'Bike deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Analytics Dashboard calculations
app.get('/api/analytics', async (req, res) => {
  if (!dbConnected) {
    return res.status(503).json({ error: 'Database not connected.' });
  }
  try {
    const bikes = await Bike.find({});

    // Capital pool calculation
    const capitalEntries = await CapitalEntry.find().sort({ addedAt: -1 });
    const totalCapitalAdded = capitalEntries.reduce((s, e) => s + e.amount, 0);
    const totalBuyingCostAllBikes = bikes.reduce((s, b) => s + (b.buyingPrice || 0), 0);
    const capitalSummary = {
      totalCapital: totalCapitalAdded,
      capitalUsed: totalBuyingCostAllBikes,
      remainingCash: totalCapitalAdded - totalBuyingCostAllBikes,
      entries: capitalEntries
    };
    
    let totalInvested = 0; // Total bought cost of all bikes
    let activeInvestment = 0; // Cost of bikes still available
    let totalRevenue = 0; // Total selling price of sold bikes
    let totalProfit = 0; // Sum of (sellPrice - buyPrice) of sold bikes
    let soldCount = 0;
    let availableCount = 0;
    let profitCount = 0; // Count of sold bikes that made profit
    
    // Group monthly data
    const monthlyGroups = {};

    bikes.forEach(bike => {
      // Sum stats
      totalInvested += bike.buyingPrice;
      if (bike.status === 'Available') {
        activeInvestment += bike.buyingPrice;
        availableCount++;
      } else if (bike.status === 'Sold') {
        totalRevenue += bike.sellingPrice;
        const profit = bike.sellingPrice - bike.buyingPrice;
        totalProfit += profit;
        soldCount++;
        if (profit > 0) profitCount++;

        // Add to monthly groups using sale date
        if (bike.saleDate) {
          const date = new Date(bike.saleDate);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          
          if (!monthlyGroups[monthKey]) {
            monthlyGroups[monthKey] = {
              month: monthKey,
              revenue: 0,
              investment: 0,
              profit: 0,
              bikesSold: 0
            };
          }
          
          monthlyGroups[monthKey].revenue += bike.sellingPrice;
          monthlyGroups[monthKey].investment += bike.buyingPrice;
          monthlyGroups[monthKey].profit += profit;
          monthlyGroups[monthKey].bikesSold += 1;
        }
      }
    });

    const roi = totalInvested - activeInvestment > 0 
      ? (totalProfit / (totalInvested - activeInvestment)) * 100 
      : 0;

    // Convert monthly groups to sorted array
    const monthlyData = Object.values(monthlyGroups).sort((a, b) => a.month.localeCompare(b.month));

    // Map month keys to human-readable month names (e.g. "2026-05" -> "May 2026")
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formattedMonthlyData = monthlyData.map(item => {
      const [year, monthNum] = item.month.split('-');
      const monthName = monthNames[parseInt(monthNum, 10) - 1];
      return {
        ...item,
        label: `${monthName} ${year}`
      };
    });

    res.json({
      summary: {
        totalInvested,
        activeInvestment,
        totalRevenue,
        totalProfit,
        totalBikes: bikes.length,
        availableCount,
        soldCount,
        roi: roi.toFixed(1),
        // Capital pool summary
        totalCapital: capitalSummary.totalCapital,
        capitalUsedInBikes: capitalSummary.capitalUsed,
        remainingCash: capitalSummary.remainingCash
      },
      monthlyData: formattedMonthlyData,
      capitalEntries: capitalSummary.entries
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── CAPITAL POOL ROUTES ──────────────────────────────────────────────────────

// GET - Capital pool summary
app.get('/api/capital', async (req, res) => {
  if (!dbConnected) {
    return res.status(503).json({ error: 'Database not connected.' });
  }
  try {
    const entries = await CapitalEntry.find().sort({ addedAt: -1 });
    const bikes = await Bike.find();
    const totalCapital = entries.reduce((s, e) => s + e.amount, 0);
    const capitalUsed = bikes.reduce((s, b) => s + (b.buyingPrice || 0), 0);
    const remainingCash = totalCapital - capitalUsed;
    res.json({ totalCapital, capitalUsed, remainingCash, entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST - Add capital injection
app.post('/api/capital', async (req, res) => {
  if (!dbConnected) {
    return res.status(503).json({ error: 'Database not connected.' });
  }
  const { amount, note } = req.body;
  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'A valid positive amount is required.' });
  }
  try {
    const entry = await CapitalEntry.create({
      amount: Number(amount),
      note: note || '',
      addedAt: new Date()
    });
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Remove a capital entry
app.delete('/api/capital/:id', async (req, res) => {
  if (!dbConnected) {
    return res.status(503).json({ error: 'Database not connected.' });
  }
  try {
    await CapitalEntry.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT - Edit a capital entry (amount and/or note)
app.put('/api/capital/:id', async (req, res) => {
  if (!dbConnected) {
    return res.status(503).json({ error: 'Database not connected.' });
  }
  const { amount, note } = req.body;
  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'A valid positive amount is required.' });
  }
  try {
    const entry = await CapitalEntry.findByIdAndUpdate(
      req.params.id,
      { amount: Number(amount), note: note || '' },
      { new: true }
    );
    if (!entry) return res.status(404).json({ error: 'Capital entry not found.' });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── END CAPITAL POOL ROUTES ──────────────────────────────────────────────────

// POST - Verify admin password
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  try {
    let actualPassword = 'gk2026';
    if (dbConnected) {
      const setting = await AdminSetting.findOne({ key: 'admin_password' });
      if (setting) {
        actualPassword = setting.value;
      }
    }

    if (password === actualPassword) {
      return res.json({ success: true, token: 'gk_admin_session_' + Date.now() });
    } else {
      return res.status(401).json({ error: 'Incorrect password' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// POST - Change admin password
app.post('/api/admin/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both current password and new password are required' });
  }

  try {
    let actualPassword = 'gk2026';
    let settingDoc = null;

    if (dbConnected) {
      settingDoc = await AdminSetting.findOne({ key: 'admin_password' });
      if (settingDoc) {
        actualPassword = settingDoc.value;
      }
    }

    if (currentPassword !== actualPassword) {
      return res.status(401).json({ error: 'Current password does not match' });
    }

    if (dbConnected) {
      if (settingDoc) {
        settingDoc.value = newPassword;
        await settingDoc.save();
      } else {
        await AdminSetting.create({ key: 'admin_password', value: newPassword });
      }
      res.json({ success: true, message: 'Password changed successfully in database.' });
    } else {
      res.status(503).json({ error: 'Database is disconnected. Cannot update password permanently.' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve admin portal directly on /admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Fallback to serving public/index.html for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
