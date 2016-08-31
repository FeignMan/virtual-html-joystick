"use strict";

var bunyan = require("bunyan");
var express = require("express");
var http = require("http");
var os = require("os");
var socketioLib = require("socket.io");
var WebSocketServer = require("ws").Server;

var gameSocketServer = new WebSocketServer({port: 3000});
var gameConnected = false;

var HTTP_PORT = 80;

var logger = bunyan.createLogger({
	name: "express",
	serializers: {
		err: bunyan.stdSerializers.err
	},
	server: "GameJamServer",
});

function getLocalIP() {
	var ifaces = os.networkInterfaces();
	var result = [];
	Object.keys(ifaces).forEach(function(ifName) {

		ifaces[ifName].forEach(function(iface) {
			if ('IPv4' !== iface.family || iface.internal !== false) {
				//	skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
				return;
			}
			result.push(iface.address);
		})
	})
	return result;
}

var app = express();

//	Add IP to the request. We'll identify users by IP
app.use(function(req, res, next) {
	Object.defineProperty(req, "ip", {
		value: (req.ip ||
			req.connection.remoteAddress ||
			req.socket.remoteAddress ||
			req.connection.socket.remoteAddress).trim(),
	});

	return next();
});

app.use(function(req, res, next) {
	var startTime = process.hrtime();
	res.on("finish", function() {
		var diff = process.hrtime(startTime);
		var duration = diff[0] * 1e3 + diff[1] * 1e-6; // ms

		return logger.info({
			body: JSON.stringify(req.body),
			duration: duration,
			ip: req.ip,
			method: req.method,
			route: req.route && (req.baseUrl + req.route.path.toString()),
			status: res.statusCode,
			url: req.originalUrl,
		}, "Request");

	});
	return next();
});

var router = express.Router({
	caseSensitive: true,
	strict: true
});

// define routes here
router.get("/ping", function(request, response)
{
	return response.end("Shit works!");
})
// end route definitions

app.use("/ws", router);
app.use(express.static(__dirname + "/public"));

app.use(function(err, request, response, next) {
	logger.error({
		err: err,
		method: request.method,
		url: request.url
	}, err.message)
	return response.status(500).end();
});

//	---------------------***** Start up *****---------------------	//
var server = http.createServer(app);
server.listen(HTTP_PORT, function() {
	var ipAdresses = getLocalIP();
	logger.info({ port: HTTP_PORT, ipAddresses: ipAdresses }, "Server listening...");
});

var io = socketioLib.listen(server);
var connections = {};
var playerId = 0;

function broadcastEvent(event) {
	if (!gameConnected) return;
	gameSocketServer.clients.forEach(function(client) {
		client.send(JSON.stringify(event));
	})
}

io.sockets.on("connection", function(socket) {
	var remoteAddress = socket.handshake.address;/*socket.client.conn.remoteAddress;*/
	logger.info("Socket connection from:", remoteAddress);

	if (!connections.hasOwnProperty(remoteAddress)) {
		connections[remoteAddress] = { playerId: playerId, teamId: playerId % 2 };
		logger.info({ ipAddr: remoteAddress, playerId: connections[remoteAddress].playerId }, "New Player Joined!");
		var spawnEvent = JSON.parse(JSON.stringify(connections[remoteAddress]));
		spawnEvent.messageType = "SpawnPlayer";
		broadcastEvent(spawnEvent);
		playerId++;
	}
	else {
		logger.info({ ipAddr: remoteAddress, playerId: connections[remoteAddress].playerId }, "Existing Player Rejoined!");
	}
	
	socket.emit("registrationSuccess", connections[remoteAddress]);

	socket.on("disconnect", function() {
		logger.info({ ipAddr: remoteAddress, playerId: connections[remoteAddress].playerId }, "Player lost!");
	});

	socket.on("joystickData", function(data) {
		// console.log("Joystick info:", data);
		var inputEvent = data;
		inputEvent.messageType = "PlayerInput";
		broadcastEvent(inputEvent);
	});
});

function handleHandshake(ws, messageObj) {
	if (messageObj.data === "JingleBalls") {
		logger.info("Handshake accepted from game client");
		gameConnected = true;

		//	send handshake response, including all connected joysticks
		var response = { messageType: "HandshakeResponse" };
		response.existingConnections = Object.keys(connections).map(function(ip) { 
			var spawnEvent = JSON.parse(JSON.stringify(connections[ip]));
			spawnEvent.messageType = "SpawnPlayer";
			return spawnEvent;
		});
		ws.send(JSON.stringify(response));
	}
	else {
		logger.error("Incorrect handshake message received");
		//	close ws connection
	}
}

gameSocketServer.on("connection", function(ws)
{
	ws.on("message", function(data)
	{	
		try {
			var message = JSON.parse(data);
			switch(message.messageType) {
				case "handshake":
					handleHandshake(ws, message);
					break;
				default:
					logger.error({ message: message }, "Unknown message type received");
					break;
			}
		}
		catch (err) {
			logger.error({rawMessage: data}, "GameClient tried to connect with a bad handshake message");
			//	close ws connection
		}
	});

	ws.on("close", function() {
		logger.info("Connection closed");
	})
});
