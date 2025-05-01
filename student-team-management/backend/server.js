// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware - Order is important
// CORS middleware first
app.use(cors());

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Create database file for fallback
const DB_FILE = path.join(__dirname, 'db.json');
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ members: [] }, null, 2), 'utf8');
  console.log('Created new fallback database file');
}

// Set up JSON file database functions
const readDatabase = () => {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database file:', error);
    return { members: [] };
  }
};

const writeDatabase = (data) => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing to database file:', error);
  }
};

// Track if MongoDB is connected
let isMongoConnected = false;

// MongoDB Connection - use your actual password
mongoose.connect('mongodb+srv://sb9140:soubhagya9140@cluster0.2vccmyn.mongodb.net/teamManagement?retryWrites=true&w=majority&appName=Cluster0')
.then(() => {
  console.log('MongoDB connected successfully');
  isMongoConnected = true;
})
.catch(err => {
  console.error('MongoDB connection error:', err.message);
  console.log('Falling back to local JSON database');
  isMongoConnected = false;
});

// Set up storage for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Define Member Schema
const memberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rollNumber: { type: String, required: true },
  year: { type: String, required: true },
  degree: { type: String, required: true },
  aboutProject: { type: String },
  hobbies: { type: String },
  certificate: { type: String },
  internship: { type: String },
  aboutAim: { type: String },
  profileImage: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const Member = mongoose.model('Member', memberSchema);

// API Routes
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working correctly',
    database: isMongoConnected ? 'MongoDB' : 'Local JSON'
  });
});

// GET all members
app.get('/api/members', async (req, res) => {
  try {
    if (isMongoConnected) {
      // Use MongoDB
      const members = await Member.find();
      res.json(members);
    } else {
      // Use local JSON file
      const db = readDatabase();
      res.json(db.members);
    }
  } catch (err) {
    console.error('Error fetching members:', err);
    
    // Fallback to JSON if MongoDB query fails
    if (isMongoConnected) {
      try {
        const db = readDatabase();
        res.json(db.members);
      } catch (fallbackErr) {
        res.status(500).json({ message: 'Failed to retrieve members' });
      }
    } else {
      res.status(500).json({ message: err.message });
    }
  }
});

// GET a single member
app.get('/api/members/:id', async (req, res) => {
  try {
    if (isMongoConnected) {
      // Use MongoDB
      const member = await Member.findById(req.params.id);
      if (!member) {
        return res.status(404).json({ message: 'Member not found' });
      }
      res.json(member);
    } else {
      // Use local JSON file
      const db = readDatabase();
      const member = db.members.find(m => m._id === req.params.id);
      if (!member) {
        return res.status(404).json({ message: 'Member not found' });
      }
      res.json(member);
    }
  } catch (err) {
    console.error('Error fetching member by id:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST a new member
app.post('/api/members', upload.single('profileImage'), async (req, res) => {
  console.log('POST /api/members - Request received');
  
  // Check if body exists
  if (!req.body) {
    console.error('req.body is undefined');
    return res.status(400).json({ message: 'No request body received' });
  }

  console.log('Body:', req.body);
  console.log('File:', req.file);
  
  try {
    const memberData = {
      name: req.body.name || '',
      rollNumber: req.body.rollNumber || '',
      year: req.body.year || '',
      degree: req.body.degree || '',
      aboutProject: req.body.aboutProject || '',
      hobbies: req.body.hobbies || '',
      certificate: req.body.certificate || '',
      internship: req.body.internship || '',
      aboutAim: req.body.aboutAim || '',
      profileImage: req.file ? req.file.filename : null
    };
    
    // Validate required fields
    if (!memberData.name || !memberData.rollNumber || !memberData.year || !memberData.degree) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        received: memberData 
      });
    }
    
    let savedMember;
    
    if (isMongoConnected) {
      // Try to save to MongoDB
      try {
        console.log('Saving to MongoDB...');
        const newMember = new Member(memberData);
        savedMember = await newMember.save();
        console.log('Member saved to MongoDB:', savedMember);
      } catch (mongoErr) {
        console.error('Error saving to MongoDB, falling back to JSON:', mongoErr);
        isMongoConnected = false; // Switch to JSON mode if MongoDB fails
      }
    }
    
    if (!isMongoConnected) {
      // Save to JSON file
      console.log('Saving to JSON file...');
      const db = readDatabase();
      const newMember = {
        _id: Date.now().toString(), // Simple unique ID
        ...memberData,
        createdAt: new Date().toISOString()
      };
      db.members.push(newMember);
      writeDatabase(db);
      savedMember = newMember;
      console.log('Member saved to JSON file:', savedMember);
    }
    
    res.status(201).json(savedMember);
  } catch (err) {
    console.error('Error saving member:', err);
    res.status(400).json({ message: err.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date(),
    database: isMongoConnected ? 'MongoDB' : 'Local JSON file',
    mongoStatus: mongoose.connection.readyState
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api/members`);
  console.log(`Health check at http://localhost:${PORT}/health`);
  console.log(`Database mode: ${isMongoConnected ? 'MongoDB (primary)' : 'Local JSON (fallback)'}`);
});
