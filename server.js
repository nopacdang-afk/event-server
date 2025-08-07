const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');

const app = express();
app.use(cors({
    origin: ['https://event-app-two-ecru.vercel.app/', 'https://event-server-hkf7.onrender.com'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));
app.use(bodyParser.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        fs.mkdir(uploadDir, { recursive: true }).then(() => cb(null, uploadDir));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${uniqueSuffix}-${file.originalname}`);
    }
});
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (['image/jpeg', 'image/png'].includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG and PNG files are allowed'), false);
        }
    },
    limits: { files: 15 }
});

const ADMIN_PASSWORD = '7894Zee';
const DATA_FILE = path.join(__dirname, 'data.json');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
    }
});

const initDataFile = async () => {
    try {
        await fs.access(DATA_FILE);
    } catch {
        await fs.writeFile(DATA_FILE, JSON.stringify([]));
        console.log('Initialized empty data.json');
    }
};

app.get('/data', async (req, res) => {
    try {
        await initDataFile();
        const data = await fs.readFile(DATA_FILE, 'utf8');
        console.log('GET /data: Returning data', data);
        res.json(JSON.parse(data));
    } catch (err) {
        console.error('GET /data error:', err.message);
        res.status(500).json({ error: `Failed to fetch data: ${err.message}` });
    }
});

app.post('/save', async (req, res) => {
    try {
        const newData = req.body;
        if (!newData.block || newData.events === undefined || !newData.remarks) {
            return res.status(400).json({ error: 'Invalid data format' });
        }
        await initDataFile();
        const currentData = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
        
        if (currentData.some(item => item.block === newData.block)) {
            return res.status(400).json({ error: `Data for block ${newData.block} already exists` });
        }

        const updatedData = [...currentData, { ...newData, photos: [] }];
        await fs.writeFile(DATA_FILE, JSON.stringify(updatedData));
        console.log('POST /save: Data saved', newData);
        res.json(updatedData);
    } catch (err) {
        console.error('POST /save error:', err.message);
        res.status(500).json({ error: `Failed to save data: ${err.message}` });
    }
});

app.post('/admin-login', async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ error: 'Password required' });
        }
        if (password !== ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Incorrect password' });
        }
        console.log('POST /admin-login: Successful login');
        res.json({ message: 'Login successful' });
    } catch (err) {
        console.error('POST /admin-login error:', err.message);
        res.status(500).json({ error: `Login failed: ${err.message}` });
    }
});

app.post('/clear-data', async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ error: 'Password required' });
        }
        if (password !== ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Incorrect password' });
        }
        await fs.writeFile(DATA_FILE, JSON.stringify([]));
        const uploadDir = path.join(__dirname, 'uploads');
        await fs.rm(uploadDir, { recursive: true, force: true });
        console.log('POST /clear-data: Data and photos cleared');
        res.json({ message: 'Data and photos cleared successfully' });
    } catch (err) {
        console.error('POST /clear-data error:', err.message);
        res.status(500).json({ error: `Failed to clear data: ${err.message}` });
    }
});

app.post('/upload-photos', upload.array('photos', 15), async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ error: 'Password required' });
        }
        if (password !== ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Incorrect password' });
        }
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No photos uploaded' });
        }

        const filenames = req.files.map(file => file.filename);
        console.log('POST /upload-photos: Photos uploaded', filenames);
        res.json({ message: 'Photos uploaded successfully', filenames });
    } catch (err) {
        console.error('POST /upload-photos error:', err.message);
        res.status(500).json({ error: `Failed to upload photos: ${err.message}` });
    }
});

app.post('/send-csv', async (req, res) => {
    try {
        const { password, data, totalEvents } = req.body;
        if (!password) {
            return res.status(400).json({ error: 'Password required' });
        }
        if (password !== ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Incorrect password' });
        }
        if (!data || data.length === 0) {
            return res.status(400).json({ error: 'No data to send' });
        }
        if (typeof totalEvents !== 'number') {
            return res.status(400).json({ error: 'Invalid totalEvents value' });
        }

        const csvContent = [
            'Block,Number of Events,Remarks,Photos',
            ...data.map(item => `${item.block},${item.events},"${item.remarks.replace(/"/g, '""')}","${(item.photos || []).join(',')}"`),
            `Total Events,${totalEvents},,`
        ].join('\n');

        const mailOptions = {
            from: process.env.EMAIL_USER || 'your-email@gmail.com',
            to: 'nopacdang@gmail.com',
            subject: 'Har Ghar Tiranga Event Details CSV',
            text: 'Attached is the Har Ghar Tiranga event details CSV file, including total events.',
            attachments: [
                {
                    filename: 'har_ghar_tiranga.csv',
                    content: csvContent,
                    contentType: 'text/csv'
                }
            ]
        };

        try {
            await transporter.verify();
            console.log('POST /send-csv: Email server connection verified');
        } catch (verifyErr) {
            console.error('POST /send-csv: Email server verification failed:', verifyErr.message);
            return res.status(500).json({ error: `Email server configuration error: ${verifyErr.message}` });
        }

        await transporter.sendMail(mailOptions);
        console.log('POST /send-csv: Email sent successfully');
        res.json({ message: 'CSV emailed successfully to nopacdang@gmail.com' });
    } catch (err) {
        console.error('POST /send-csv error:', err.message);
        res.status(500).json({ error: `Failed to send email: ${err.message}` });
    }
});

app.listen(process.env.PORT || 3000, () => {
    console.log(`Server running on port ${process.env.PORT || 3000}`);
});