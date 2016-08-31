//  http://www.paulirish.com/2011/requestanimationframe-for-smart-animating/

window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    function (callback) {
        window.setTimeout(callback, 1000 / 60);
    };
})();

var socket,
connected,
localData,
canvas,
c, // c is the canvas' context 2D
container,
halfWidth,
halfHeight,
leftPointerID = -1,
leftPointerPos = new Vector2(0, 0),
leftPointerStartPos = new Vector2(0, 0),
leftVector = new Vector2(0, 0);

var touches; // collections of pointers

document.addEventListener("DOMContentLoaded", init);

window.onorientationchange = resetCanvas;
window.onresize = resetCanvas;

function init() {
    connected = false;
    setupSocket();
    setupCanvas();
    touches = new Collection();
    canvas.addEventListener('pointerdown', onPointerDown, false);
    canvas.addEventListener('pointermove', onPointerMove, false);
    canvas.addEventListener('pointerup', onPointerUp, false);
    canvas.addEventListener('pointerout', onPointerUp, false);
    requestAnimFrame(draw);
}

function resetCanvas(e) {
    // resize the canvas - but remember - this clears the canvas too. 
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    halfWidth = canvas.width / 2;
    halfHeight = canvas.height / 2;

    //make sure we scroll to the top left. 
    window.scrollTo(0, 0);
}

function draw() {
    c.clearRect(0, 0, canvas.width, canvas.height);

    var buttonState = false;
    touches.forEach(function (touch) {
        if (touch.identifier == leftPointerID) {
            c.beginPath();
            c.strokeStyle = "cyan";
            c.lineWidth = 6;
            c.arc(leftPointerStartPos.x, leftPointerStartPos.y, 40, 0, Math.PI * 2, true);
            c.stroke();
            c.beginPath();
            c.strokeStyle = "cyan";
            c.lineWidth = 2;
            c.arc(leftPointerStartPos.x, leftPointerStartPos.y, 60, 0, Math.PI * 2, true);
            c.stroke();
            c.beginPath();
            c.strokeStyle = "cyan";
            c.arc(leftPointerPos.x, leftPointerPos.y, 40, 0, Math.PI * 2, true);
            c.stroke();

        } else {
            buttonState = true;

            c.beginPath();
            c.fillStyle = "white";
            c.fillText("type : " + touch.type + " id : " + touch.identifier + " x:" + touch.x + " y:" + touch.y, touch.x + 30, touch.y - 30);

            c.beginPath();
            c.strokeStyle = "red";
            c.lineWidth = "6";
            c.arc(touch.x, touch.y, 40, 0, Math.PI * 2, true);
            c.stroke();
        }
    });

    if (connected && localData) {
        c.fillStyle = "white";
        c.fillText("Player ID: " + localData.playerId, 10, 10);
        c.fillText("Team ID: " + localData.teamId, 10, 20);
        c.fillText("Connection Status: true", 10, 30);
    }
    else {
        c.fillStyle = "white";
        c.fillText("Connection Status: false", 10, 30);
    }
    c.fillStyle = "white";
    c.fillText("Touch on the left to move", halfWidth * 0.5 - 50, halfHeight);
    c.fillStyle = "white";
    c.fillText("Touch on the right to jump", halfWidth * 1.5 - 50, halfHeight);

    transmitJoystickData(buttonState);

    requestAnimFrame(draw);
}

function givePointerType(event) {
    switch (event.pointerType) {
        case event.POINTER_TYPE_MOUSE:
            return "MOUSE";
            break;
        case event.POINTER_TYPE_PEN:
            return "PEN";
            break;
        case event.POINTER_TYPE_TOUCH:
            return "TOUCH";
            break;
    }
}

function onPointerDown(e) {
    var newPointer = { identifier: e.pointerId, x: e.clientX, y: e.clientY, type: givePointerType(e) };
    if ((leftPointerID < 0) && (e.clientX < halfWidth)) {
        leftPointerID = e.pointerId;
        leftPointerStartPos.reset(e.clientX, e.clientY);
        leftPointerPos.copyFrom(leftPointerStartPos);
        leftVector.reset(0, 0);
    }
    touches.add(e.pointerId, newPointer);
}

function onPointerMove(e) {
    if (leftPointerID == e.pointerId) {
        leftPointerPos.reset(e.clientX, e.clientY);
        leftVector.copyFrom(leftPointerPos);
        leftVector.minusEq(leftPointerStartPos);
    }
    else {
        if (touches.item(e.pointerId)) {
            touches.item(e.pointerId).x = e.clientX;
            touches.item(e.pointerId).y = e.clientY;
        }
    }
}

function onPointerUp(e) {
    if (leftPointerID == e.pointerId) {
        leftPointerID = -1;
        leftVector.reset(0, 0);

    }
    leftVector.reset(0, 0);

    touches.remove(e.pointerId);
}

function setupCanvas() {
    canvas = document.getElementById('joystickCanvas');
    c = canvas.getContext('2d');
    resetCanvas();
    c.strokeStyle = "#ffffff";
    c.lineWidth = 2;
}

function setupSocket() {
    socket = io();

    socket.on("connect", function() {
        connected = true;

        socket.on("registrationSuccess", function(data) {
            console.log("Registration Successfull!:", data);
            localData = data;
        });

    });

    socket.on("disconnect", function() {
        connected = false;
        localData = null;
        console.log("Disconnected!");
    });
}

function transmitJoystickData(buttonState) {
    if (connected && localData)
        socket.emit("joystickData", {
            xAxis: Math.max(Math.min(80, leftVector.x), -80) / 80,
            yAxis: Math.max(Math.min(80, leftVector.y), -80) / 80,
            jump: buttonState,
            playerId: localData.playerId
        });
}