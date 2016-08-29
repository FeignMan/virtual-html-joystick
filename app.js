"use strict";

var bunyan = require("bunyan");
var express = require("express");

var logger = bunyan.createLogger({
	name: "express",
	serializers: {
		err: bunyan.stdSerializers.err
	},
	server: "GameJamServer",
});

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
app.use("/static", express.static(__dirname + "/public"));

app.use(function(err, request, response, next) {
	logger.error({
		err: err,
		method: request.method,
		url: request.url
	}, err.message)
	return response.status(500).end();
});

app.listen(3000, function() {
	logger.info({ port: 3000 }, "Server listening...");
});