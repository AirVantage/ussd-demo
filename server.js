"use strict";

const express = require('express');
const bodyParser = require('body-parser');
const favicon = require('serve-favicon');
const path = require('path');
const serveStatic = require('serve-static');
const soap = require('soap');
const mbqtWSDLURL = path.resolve('./MBQTSubscriptionService.wsdl');

// Create the web app server + socket.io setup
const app = express();
const server = require('http').Server(app);
const socketio = require('socket.io');
const io = socketio(server);

const configuration = require('./config');

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
let clients = {},
    soapClient,
    sessionAuthId;

// Give the createClient Method the WSDL as the first argument
soap.createClient(mbqtWSDLURL, (err, client) => {
    soapClient = client;
    soapLogin();
});

function soapLogin() {
    const promise = new Promise((resolve, reject) => {
        soapClient.login({
            userLogin: configuration.network.login,
            userPwd: configuration.network.password
        }, (err, result, body) => {
            if (err) {
                console.err("Error trying to login to MBQT SOAP APIs:", err);
                reject(err);
                return;
            }
            sessionAuthId = result.sessionAuthId;
            resolve();
        });
    });

    return promise;
}

// GET "/" route that displays what is received on POST "/" route
app.get('/', (req, res) => res.render('index'));

// Webhook route
app.post('/', (req, res) => {
    io.emit('ussd', {
        content: req.body
    });

    // Device initiated session
    if (req.body.ussdstring === `*${configuration.network.login}#`) {
        // automatically ask for the temperature
        res.status(200).send('ussdstring=Temperature&final=false&notification=false');
        return;
    }

    // Otherwise answer OK and terminate session
    res.status(200).send('ussdstring=OK');
});

/**
 * How many connected clients
 */
function getNbClients() {
    return Object.keys(clients).length;
}

function askTemperature() {
    const promise = new Promise((resolve, reject) => {
        soapClient.pushUssd({
            sessionAuthId: sessionAuthId,
            toMsisdn: configuration.network.phoneNumber,
            ussdString: "Temperature",
            appId: configuration.network.login,
            notification: false,
            final: false,
            encoding: configuration.network.encoding
        }, (err, result, body) => {
            if (err) {
                console.error("Error trying to ask for the temperature:", err);
                console.error("Result trying to ask for the temperature:", result);
                console.error("Body trying to ask for the temperature:", body);
                // Session expired
                if (err.body.indexOf("ADM017") !== -1) {
                    soapLogin()
                        .then(askTemperature)
                        .then(result => resolve(result));
                } else {
                    // Unknown error reject
                    reject(err);
                }
            } else {
                resolve(result);
            }
        });
    });

    return promise;
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
    socket.emit('welcome', {
        appId: configuration.network.login,
        nbClients: nbClients
    });
    // Inform every clients that someone just connected
    io.emit('updateNbClients', nbClients);

    socket.on("temperature", () => {
        askTemperature()
            .then(result => io.emit("temperatureAsked", result.sessionId))
            .catch(error => io.emit("temperatureAskedError", error))
    });

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
