"use strict";

const express = require('express');
const bodyParser = require('body-parser');
const favicon = require('serve-favicon');
const path = require('path');
const serveStatic = require('serve-static');

// Create the web app server + socket.io setup
const app = express();
const server = require('http').Server(app);
const socketio = require('socket.io');
const io = socketio(server);

// Express webapp setup
app.engine('.html', require('ejs').__express);
app.set('views', './views');
app.set('view engine', 'html');

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(bodyParser.json());
app.use(bodyParser.text());
app.use(bodyParser.raw());
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(serveStatic('public'));

// In memory clients storage
let clients = {};

// GET "/" route that displays what is received on POST "/" route
app.get('/', (req, res) => res.render('index'));

// Webhook route
app.post('/', (req, res) => {
    io.emit('ussd', {
        content: req.body
    });

    // Always answer "OK"
    // We could do something with the received string and answer accordingly
    res.status(200).send('ussdstring=OK');
});

/**
 * How many connected clients
 */
function getNbClients() {
    return Object.keys(clients).length;
}

// Socket.io setup
io.on('connection', socket => {
    // Store it
    const clientId = socket.id;
    clients[clientId] = socket;
    const nbClients = getNbClients();

    console.log("New client connected with id:", clientId);
    console.log(nbClients, "client(s) connected");

    // Handshake with the new client
    socket.emit('welcome', nbClients);
    // Inform every clients that someone just connected
    io.emit('updateNbClients', nbClients);

    // Handle client disconnection
    socket.on('disconnect', () => {
        delete clients[clientId];
        console.log("Someone just left");
        console.log(getNbClients(), "client(s) connected");
        // Inform everyone that someone just left
        io.emit('updateNbClients', getNbClients())
    });
});

app.set('port', process.env.PORT || 3000);
server.listen(app.get("port"), () => console.log('AirVantage USSD app listening on port', app.get("port"), '\\o/'));
