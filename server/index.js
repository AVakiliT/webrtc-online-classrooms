var config = require('./config.js').default;
var N = require('./nuve');

N.API.init(config.service.id, config.service.key, config.nuve_host);

var express = require('express');
var app = express();
var http = require('http');
var io = require('socket.io')(http);
var roomData = require('roomdata');
var SocketEvent = require('./serverconstants').SocketEvent;
// app.use(express.bodyParser());
// app.configure(function () {
//   app.use(express.logger());
//   app.use(express.static(__dirname + '/public'));
// });

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.post('/createRoom/', function (req, res) {

  N.API.createRoom('myRoom', function (roomID) {
    res.send(roomID);
  }, function (e) {
    console.log(e)
  });
});

app.get('/getRooms/', function (req, res) {

  N.API.getRooms(function (rooms) {
    res.send(rooms);
  }, function (e) {
    res.status(500);res.send("Internal Server Error");
  });
});

app.get('/getUsers/:room', function (req, res) {

  var room = req.params.room;
  N.API.getUsers(room, function (users) {
    res.send(users);
  }, function (e) {
    res.status(500);res.send("Internal Server Error");
  });
});

app.post('/createToken/:room', function (req, res) {

  var room = req.params.room;
  var username = req.body.username;
  var role = req.body.role;
  N.API.createToken(room, username, role, function (token) {
    res.send(token);
  }, function (e) {
    res.status(500);res.send("Internal Server Error");
  });
});

app.post('/getOrCreateRoom/', function (req, res) {
  console.log(req);
  var username = req.body.username;
  var roomName = req.body.roomName;
  var role = req.body.role;

  var createToken = function (id, username, role) {
    N.API.createToken(id, username, role, function (token) {
      res.send({token: token, roomId: id});
    }, function (e) {
      console.log(e);
    });
  };

  N.API.getRooms(function (roomList) {
    let rooms = JSON.parse(roomList);
    let room = rooms.find((room) => room.name === roomName);
    if (room) {
      createToken(room._id, username, role);
    } else {
      N.API.createRoom(roomName, function (room) {
        createToken(room._id, username, role);
      }, function (e) {
        console.log(e);
      });
    }
  }, function (e) {
    console.log(e);
  });
});

var rooms = [];

function isPresenter(socket){
  return roomData.get(socket, 'presenter') === socket.id;
}

io.on('connection', function (socket) {
  socket.on(SocketEvent.JOIN_ROOM, function (roomName, username) {
    socket.room = roomName;
    socket.username = username;
    roomData.joinRoom(socket, roomName);
    socket.emit(SocketEvent.ROOM_INFO, JSON.stringify(roomData.get(socket, 'info')));
  });

  socket.on(SocketEvent.REQ_PRESENTER, function(){
    var presenter = roomData.get(socket, 'presenter');
    if(presenter) {
      socket.emit(SocketEvent.REJECT_PRESENTER, '');
    } else {
      roomData.set(socket, 'presenter', socket.id);
      socket.emit(SocketEvent.ACCEPT_PRESENTER, '');
      socket.broadcast.to(socket.room).emit(SocketEvent.PRESENTATION_START, socket.username);
    }
  });

  socket.on(SocketEvent.STOP_PRESENTER, function(){
    var presenter = roomData.get(socket, 'presenter');
    if(presenter) {
      roomData.set(socket, 'presenter', null);
      socket.broadcast.to(socket.room).emit(SocketEvent.PRESENTATION_STOP);
    }
  });

  socket.on('disconnect', function(){
    if(isPresenter(socket)) {
      roomData.set(socket, 'presenter', null);
      socket.broadcast.to(socket.room).emit(SocketEvent.PRESENTATION_STOP);
    }
  });

  socket.on(SocketEvent.SET_SNAPSHOT, function (snapShot) {
    if (isPresenter(socket)){
      var info = roomData.get(socket, 'info');
      info.snapShot = snapShot;
      io.sockets.in(socket.room).emit(SocketEvent.SET_SNAPSHOT, socket.username, data);
    }
  });

  socket.on(SocketEvent.SET_PDF_FILE, function (pdfFile) {
    if (isPresenter(socket)){
      var info = roomData.get(socket, 'info');
      info.pdfFile = pdfFile;
      io.sockets.in(socket.room).emit(SocketEvent.SET_PDF_FILE, socket.username, data);
    }
  });
});

app.listen(3015);
console.log("listening on 3015");
