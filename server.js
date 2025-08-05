const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const ADMIN_PASSWORD = '7894Zee';
const DATA_FILE = path.join(__dirname, 'data.json');

// Initialize data file
const initDataFile = async () => {
    try {
        await fs.access(DATA_FILE);
    } catch {
        await fs.writeFile(DATA_FILE, JSON.stringify([]));
    }
};

// Get all data
app.get('/data', async (req, res) => {
    try {
        await initDataFile();
        const data = await fs.readFile(DATA_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        console.error('Get data error:', err);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

// Save new data
app.post('/save', async (req, res) => {
    try {
        const newData = req.body;
        await initDataFile();
        const currentData = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
        
        if (currentData.some(item => item.block === newData.block)) {
            return res.status(400).json({ error: `Data for block ${newData.block} already exists` });
        }

        const updatedData = [...currentData, newData];
        await fs.writeFile(DATA_FILE, JSON.stringify(updatedData));
        res.json(updatedData);
        console.log('Data saved:', newData);
    } catch (err) {
        console.error('Save error:', err);
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// Admin login
app.post('/admin-login', async (req, res) => {
    const { password } = req.body;
    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Incorrect password' });
    }
    res.json({ message: 'Login successful' });
});

// Clear all data
app.post('/clear-data', async (req, res) => {
    const { password } = req.body;
    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Incorrect password' });
    }
    try {
        await fs.writeFile(DATA_FILE, JSON.stringify([]));
        res.json({ message: 'Data cleared successfully' });
        console.log('Data cleared');
    } catch (err) {
        console.error('Clear data error:', err);
        res.status(500).json({ error: 'Failed to clear data' });
    }
});

app.listen(process.env.PORT || 3000, () => {
    console.log('Server running on port', process.env.PORT || 3000);
});