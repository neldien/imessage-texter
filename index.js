
import 'dotenv/config';
import express from 'express';
import osascript from 'node-osascript';
import { promisify } from 'util';
import morgan from 'morgan';
import winston from 'winston';

const app = express();
const port = 5001;

// Promisify osascript.execute
const executeScript = promisify(osascript.execute);

// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Add morgan for HTTP request logging
app.use(morgan('combined'));
app.use(express.json());

// API Key middleware
const API_KEY = process.env.API_KEY || 'your_secret_key_here';

const authenticateKey = (req, res, next) => {
    const providedKey = req.header('X-API-Key');
    if (!providedKey || providedKey !== API_KEY) {
        return res.status(401).json({ error: 'Invalid API key' });
    }
    next();
};

// Helper function to send iMessage
async function sendIMessage(phoneNumber, message) {
    const script = `
    tell application "Messages"
      set targetService to 1st service whose service type = iMessage
      set targetBuddy to buddy "${phoneNumber}" of targetService
      send "${message}" to targetBuddy
    end tell
  `;

    try {
        await executeScript(script);
        logger.info(`Message sent successfully to ${phoneNumber}`);
        return true;
    } catch (error) {
        logger.error(`Failed to send message to ${phoneNumber}: ${error.message}`);
        throw error;
    }
}

// Helper function to delay execution
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to get random delay between 10-15 seconds
function getRandomDelay() {
    return Math.floor(Math.random() * (15000 - 10000 + 1) + 10000);
}

// Routes
app.post('/sendMessage', authenticateKey, async (req, res) => {
    try {
        const { phone_number, messages } = req.body;

        if (!phone_number || !messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: phone_number and messages (array)'
            });
        }

        // Basic phone number validation and formatting
        const cleanedNumber = phone_number
            .replace(/\s+/g, '')
            .replace(/-/g, '')
            .replace(/[()]/g, '');

        if (!/^\+?\d+$/.test(cleanedNumber)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid phone number format'
            });
        }

        // Send response immediately to client
        res.json({
            success: true,
            message: `Started sending ${messages.length} messages`
        });

        // Process messages sequentially with delays
        for (let i = 0; i < messages.length; i++) {
            const message = messages[i];

            if (i > 0) {
                // Wait for random delay before sending next message
                await delay(getRandomDelay());
            }

            await sendIMessage(cleanedNumber, message);
            logger.info(`Sent message ${i + 1}/${messages.length} to ${cleanedNumber}`);
        }
    } catch (error) {
        logger.error('Error sending messages:', error);
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

// Add a new endpoint for bulk messaging
app.post('/sendBulkMessages', authenticateKey, async (req, res) => {
    try {
        const { phone_numbers, messages } = req.body;

        if (!phone_numbers || !Array.isArray(phone_numbers) || phone_numbers.length === 0 ||
            !messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: phone_numbers (array) and messages (array)'
            });
        }

        // Send response immediately to client
        res.json({
            success: true,
            message: `Started sending ${messages.length} messages to ${phone_numbers.length} recipients`
        });

        // Process each phone number
        for (let phoneNumber of phone_numbers) {
            // Clean and validate phone number
            const cleanedNumber = phoneNumber
                .replace(/\s+/g, '')
                .replace(/-/g, '')
                .replace(/[()]/g, '');

            if (!/^\+?\d+$/.test(cleanedNumber)) {
                logger.error(`Invalid phone number format: ${phoneNumber}`);
                continue;
            }

            // Process messages for this number
            try {
                for (let i = 0; i < messages.length; i++) {
                    const message = messages[i];

                    if (i > 0) {
                        // Wait for random delay between messages (10-15 seconds)
                        await delay(getRandomDelay());
                    }

                    await sendIMessage(cleanedNumber, message);
                    logger.info(`Sent message ${i + 1}/${messages.length} to ${cleanedNumber}`);
                }

                // Wait for random delay between recipients (also 10-15 seconds)
                await delay(getRandomDelay());

            } catch (error) {
                logger.error(`Failed processing number ${cleanedNumber}: ${error.message}`);
                continue; // Continue with next number even if one fails
            }
        }

        logger.info('Bulk message processing completed');

    } catch (error) {
        logger.error('Error in bulk message processing:', error);
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

app.listen(port, '0.0.0.0', () => {
    logger.info(`Server running on port ${port}`);
});

