const WebSocket = require('ws');
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });
const mysql = require('mysql2');
require('dotenv').config();

const dbHost = process.env.HOST;
const dbUser = process.env.USER;
const dbPass = process.env.PASSWORD;
const dbName = process.env.DB;
const db = mysql.createConnection({
    host: dbHost,  
    user: dbUser,       
    password: dbPass,
    database: dbName,
    port: 17379
});

db.connect(err => {
    if (err) throw err;
    console.log('Connected to the database');
});


wss.on('connection', ws => {
    console.log('New client connected');

    ws.on('message', message => {
        const parsedMessage = JSON.parse(message);
        const { from_user, to_user, message: text } = parsedMessage;

        // Store the message in the database
        const query = `INSERT INTO chats (from_user, to_user, message) VALUES (?, ?, ?)`;
        db.execute(query, [from_user, to_user, text], (err, results) => {
            if (err) {
                console.error('Failed to store message:', err);
                return;
            }

            // Broadcast the message to all clients
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        id: results.insertId,  // Get the ID of the inserted message
                        from_user,
                        to_user,
                        message: text,
                        date: new Date()  // Include the timestamp
                    }));
                }
            });

            console.log('Message stored and broadcasted');
        });
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

console.log('WebSocket server is running on ws://localhost:8080');