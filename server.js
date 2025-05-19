const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const Papa = require('papaparse');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// MongoDB connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/residentsDB', {
}).then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define Resident schema
const residentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  last_name: String,
  first_name: String,
  middle_initial: String,
  birthday: String,
  age: String,
  sex: String,
  status: String,
  purok: String,
  occupation: String,
  annual_income: String,
  contact_number: String,
  religion: String,
  nationality: String,
  housing: String
});

const Resident = mongoose.model('Resident', residentSchema);

const attendanceSchema = new mongoose.Schema({
  residentId: { type: String, required: true },
  last_name: { type: String, required: true },
  first_name: { type: String, required: true },
  middle_initial: { type: String, required: true },
  scanTime: { type: Date, default: Date.now }
});

const Attendance = mongoose.model('Attendance', attendanceSchema);

// Middleware
app.use(cors());
app.use(bodyParser.json());

// File upload middleware
const upload = multer({ dest: 'uploads/' });

// Create (C)
app.post('/residents', async (req, res) => {
  try {
    const newResident = new Resident(req.body);
    await newResident.save();
    res.status(201).json({ message: 'Resident saved successfully' });
  } catch (error) {
    console.error('Error saving resident:', error);
    res.status(500).json({ message: 'Failed to save resident' });
  }
});

// Import residents from CSV
app.post('/residents/import', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const filePath = path.join(__dirname, req.file.path);
  const file = fs.createReadStream(filePath);

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: async (results) => {
      try {
        const validResidents = results.data.filter(r =>
          r.id && r.last_name && r.first_name && r.middle_initial && r.birthday &&
          r.age && r.sex && r.status && r.purok && r.occupation && r.annual_income &&
          r.contact_number && r.religion && r.nationality && r.housing
        );

        await Resident.insertMany(validResidents, { ordered: false });
        res.status(200).json({ message: 'Residents imported successfully' });
      } catch (error) {
        console.error('Error importing residents:', error);
        res.status(500).json({ message: 'Failed to import residents' });
      } finally {
        fs.unlinkSync(filePath);
      }
    }
  });
});

// Read (R) single
app.get('/residents/:id', async (req, res) => {
  try {
    const resident = await Resident.findOne({ id: req.params.id });
    if (!resident) {
      return res.status(404).json({ message: 'Resident not found' });
    }
    res.json(resident);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving resident' });
  }
});

// Read all
app.get('/residents', async (req, res) => {
  try {
    const residents = await Resident.find();
    res.json(residents);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching residents' });
  }
});

// Update (U)
app.put('/residents/:id', async (req, res) => {
  try {
    const updated = await Resident.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!updated) {
      return res.status(404).json({ message: 'Resident not found' });
    }
    res.status(200).json({ message: 'Resident updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update resident' });
  }
});

// Delete (D)
app.delete('/residents/:id', async (req, res) => {
  try {
    await Resident.findOneAndDelete({ id: req.params.id });
    res.status(200).json({ message: 'Resident deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete resident' });
  }
});

app.post('/attendance/scan', async (req, res) => {
  const { id, last_name, first_name, middle_initial } = req.body;

  if (!id || !last_name || !first_name || !middle_initial) {
    return res.status(400).json({ message: 'Missing required QR code data' });
  }

  try {
    // Check if resident exists
    const existingResident = await Resident.findOne({ id });
    if (!existingResident) {
      return res.status(404).json({ message: 'Resident not found' });
    }

    // Create a new attendance record
    const newAttendance = new Attendance({
      residentId: id,
      last_name,
      first_name,
      middle_initial
    });

    await newAttendance.save();
    res.status(201).json({ message: 'Attendance recorded successfully' });
  } catch (error) {
    console.error('Error recording attendance:', error);
    res.status(500).json({ message: 'Failed to record attendance' });
  }
});

app.get('/attendance', async (req, res) => {
  try {
    const attendanceRecords = await Attendance.find().sort({ scanTime: -1 });
    res.json(attendanceRecords);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch attendance records' });
  }
});

app.delete("/attendance", async (req, res) => {
  try {
    await Attendance.deleteMany({});
    res.status(200).json({ message: "All attendance records deleted." });
  } catch (error) {
    console.error("Error deleting attendance records:", error);
    res.status(500).json({ message: "Failed to delete attendance records." });
  }
});


// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
