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

const clients = {};

wss.on('connection', ws => {
    console.log('New client connected');

    ws.on('message', message => {
        const parsedMessage = JSON.parse(message);
        if (parsedMessage.type === 'register') {
            const { user_id } = parsedMessage;
            clients[user_id] = ws;  
            console.log(`User ${user_id} registered and connected`);
            return;  
        }
     
        const { from_user, to_user, message: text } = parsedMessage;

        // Store the message in the database
        const query = `INSERT INTO chats (from_user, to_user, message) VALUES (?, ?, ?)`;
        db.execute(query, [from_user, to_user, text], (err, results) => {
            if (err) {
                console.error('Failed to store message:', err);
                return;
            }
            const messageToSend = JSON.stringify({
                id: results.insertId,  // Get the ID of the inserted message
                from_user,
                to_user,
                message: text,
                date: new Date()  
            });

            if (clients[from_user] && clients[from_user].readyState === WebSocket.OPEN) {
                clients[from_user].send(messageToSend);
                console.log(`Message sent to sender ${from_user}`);
            } else {
                console.error(`Sender ${from_user} not connected`);
            }

            // Send the message to the intended recipient only
            if (clients[to_user] && clients[to_user].readyState === WebSocket.OPEN) {
                clients[to_user].send(messageToSend);
                console.log(`Message sent to recipient ${to_user}`);
            } else {
                console.error(`Recipient ${to_user} not connected`);
            }

            // // Broadcast the message to all clients
            // wss.clients.forEach(client => {
            //     if (client.readyState === WebSocket.OPEN) {
            //         client.send(JSON.stringify({
            //             id: results.insertId,  // Get the ID of the inserted message
            //             from_user,
            //             to_user,
            //             message: text,
            //             date: new Date()  // Include the timestamp
            //         }));
            //     }
            // });

           // console.log('Message stored and broadcasted');
        });
    });

    ws.on('close', () => {
        for (let userId in clients) {
            if (clients[userId] === ws) {
                console.log(`User ${userId} disconnected`);
                delete clients[userId];
                break;
            }
        }
    });
});

console.log('WebSocket server is running on '+process.env.PORT || 8080);