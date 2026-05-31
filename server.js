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
      // Migrate legacy password if present
      const legacyPw = await AdminSetting.findOne({ key: 'admin_password' });
      
      const gkPwExists = await AdminSetting.findOne({ key: 'password_gk' });
      if (!gkPwExists) {
        const gkVal = legacyPw ? legacyPw.value : 'gk2026';
        await AdminSetting.create({ key: 'password_gk', value: gkVal });
        console.log('🔑 Seeded/Migrated GK admin password.');
      }

      const lmPwExists = await AdminSetting.findOne({ key: 'password_lm' });
      if (!lmPwExists) {
        await AdminSetting.create({ key: 'password_lm', value: 'lm2026' });
        console.log('🔑 Seeded default LM partner password (lm2026).');
      }
    } catch (err) {
      console.error('⚠️ Error seeding admin passwords:', err.message);
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

// GET all bikes (with filtering, search, and owner-specific routing)
app.get('/api/bikes', async (req, res) => {
  if (!dbConnected) {
    return res.status(503).json({ error: 'Database not connected. Please check your .env configuration.' });
  }
  try {
    const { status, search, owner } = req.query;
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

    // If an owner is specified, filter by it. Otherwise, return all (for the public showroom)
    if (owner && owner !== 'undefined') {
      query.owner = owner;
    }

    const bikes = await Bike.find(query).sort({ createdAt: -1 });

    // For public calls (no specific owner filter, or when displaying items on landing page),
    // we want to attach the respective owner's phone, email, and business name to each bike.
    let profiles = {
      gk: { phone: '+94 77 123 4567', email: 'owner@gkmotorcycle.com', address: 'Colombo, Sri Lanka', business: 'GK Motorcycle' },
      lm: { phone: '+94 77 987 6543', email: 'lakindu@gkmotorcycle.com', address: 'Colombo, Sri Lanka', business: 'LM Supermoto' }
    };

    if (dbConnected) {
      const profGk = await AdminSetting.findOne({ key: 'profile_gk' });
      if (profGk) profiles.gk = JSON.parse(profGk.value);
      
      const profLm = await AdminSetting.findOne({ key: 'profile_lm' });
      if (profLm) profiles.lm = JSON.parse(profLm.value);
    }

    const bikesWithProfiles = bikes.map(b => {
      const bikeOwner = b.owner || 'gk';
      const profile = profiles[bikeOwner] || profiles.gk;
      return {
        ...b.toObject(),
        ownerPhone: profile.phone,
        ownerEmail: profile.email,
        ownerAddress: profile.address,
        ownerBusiness: profile.business
      };
    });

    res.json(bikesWithProfiles);
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
    // Set owner
    bikeData.owner = req.query.owner || 'gk';

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

// GET - Analytics Dashboard calculations (Filtered by owner)
app.get('/api/analytics', async (req, res) => {
  if (!dbConnected) {
    return res.status(503).json({ error: 'Database not connected.' });
  }
  try {
    const owner = req.query.owner || 'gk';
    const bikes = await Bike.find({ owner });

    // Capital pool calculation
    const capitalEntries = await CapitalEntry.find({ owner }).sort({ addedAt: -1 });
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

// GET - Capital pool summary (Filtered by owner)
app.get('/api/capital', async (req, res) => {
  if (!dbConnected) {
    return res.status(503).json({ error: 'Database not connected.' });
  }
  try {
    const owner = req.query.owner || 'gk';
    const entries = await CapitalEntry.find({ owner }).sort({ addedAt: -1 });
    const bikes = await Bike.find({ owner });
    const totalCapital = entries.reduce((s, e) => s + e.amount, 0);
    const capitalUsed = bikes.reduce((s, b) => s + (b.buyingPrice || 0), 0);
    const remainingCash = totalCapital - capitalUsed;
    res.json({ totalCapital, capitalUsed, remainingCash, entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST - Add capital injection (Filtered by owner)
app.post('/api/capital', async (req, res) => {
  if (!dbConnected) {
    return res.status(503).json({ error: 'Database not connected.' });
  }
  const { amount, note } = req.body;
  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'A valid positive amount is required.' });
  }
  try {
    const owner = req.query.owner || 'gk';
    const entry = await CapitalEntry.create({
      amount: Number(amount),
      note: note || '',
      addedAt: new Date(),
      owner
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

// GET - profile settings for a specific owner ('gk' or 'lm')
app.get('/api/profile', async (req, res) => {
  if (!dbConnected) {
    return res.status(503).json({ error: 'Database not connected.' });
  }
  const owner = req.query.owner || 'gk';
  try {
    const key = `profile_${owner}`;
    const setting = await AdminSetting.findOne({ key });
    if (setting) {
      res.json(JSON.parse(setting.value));
    } else {
      // Fallback default profile data
      const defaultProfiles = {
        gk: {
          name: 'GK Motorcycle Administrator',
          business: 'GK Motorcycle',
          phone: '+94 77 123 4567',
          email: 'admin@gkmotorcycle.com',
          address: 'Colombo, Sri Lanka',
          avatar: 'sports'
        },
        lm: {
          name: 'Lakindu Motorcycle Proprietor',
          business: 'LM Supermoto',
          phone: '+94 77 987 6543',
          email: 'lakindu@gkmotorcycle.com',
          address: 'Colombo, Sri Lanka',
          avatar: 'adventure'
        }
      };
      res.json(defaultProfiles[owner] || defaultProfiles.gk);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - save profile settings for a specific owner ('gk' or 'lm')
app.post('/api/profile', async (req, res) => {
  if (!dbConnected) {
    return res.status(503).json({ error: 'Database not connected.' });
  }
  const owner = req.query.owner || 'gk';
  try {
    const key = `profile_${owner}`;
    const value = JSON.stringify(req.body);
    
    let setting = await AdminSetting.findOne({ key });
    if (setting) {
      setting.value = value;
      await setting.save();
    } else {
      setting = await AdminSetting.create({ key, value });
    }
    res.json({ success: true, profile: req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Verify admin password (GK or LM)
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  try {
    // 1. Fetch passwords from DB
    let gkPassword = 'gk2026';
    let lmPassword = 'lm2026';

    if (dbConnected) {
      // GK Password: try legacy 'admin_password' first, then 'password_gk'
      const legacySetting = await AdminSetting.findOne({ key: 'admin_password' });
      const gkSetting = await AdminSetting.findOne({ key: 'password_gk' });
      if (gkSetting) {
        gkPassword = gkSetting.value;
      } else if (legacySetting) {
        gkPassword = legacySetting.value;
      }

      // LM Password
      const lmSetting = await AdminSetting.findOne({ key: 'password_lm' });
      if (lmSetting) {
        lmPassword = lmSetting.value;
      }
    }

    // 2. Validate
    if (password === gkPassword) {
      return res.json({ success: true, token: 'admin_session_gk_' + Date.now(), owner: 'gk' });
    } else if (password === lmPassword) {
      return res.json({ success: true, token: 'admin_session_lm_' + Date.now(), owner: 'lm' });
    } else {
      return res.status(401).json({ error: 'Incorrect password' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// POST - Change admin password (for specific owner)
app.post('/api/admin/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const owner = req.query.owner || 'gk';
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both current password and new password are required' });
  }

  try {
    let actualPassword = owner === 'lm' ? 'lm2026' : 'gk2026';
    const key = `password_${owner}`;
    let settingDoc = null;

    if (dbConnected) {
      // GK Password fallback to legacy key 'admin_password'
      if (owner === 'gk') {
        const legacySetting = await AdminSetting.findOne({ key: 'admin_password' });
        const gkSetting = await AdminSetting.findOne({ key: 'password_gk' });
        if (gkSetting) {
          settingDoc = gkSetting;
          actualPassword = gkSetting.value;
        } else if (legacySetting) {
          settingDoc = legacySetting;
          actualPassword = legacySetting.value;
        }
      } else {
        settingDoc = await AdminSetting.findOne({ key });
        if (settingDoc) {
          actualPassword = settingDoc.value;
        }
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
        await AdminSetting.create({ key, value: newPassword });
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
