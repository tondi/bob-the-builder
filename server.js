var express = require('express')
var app = express()
var http = require('http').Server(app);
var mongoose = require("mongoose");
var server = app.listen(3000, () => {
  console.log('Port 3000!')
})
var io = require('socket.io').listen(server);

var Models = require("./database/Models.js")(mongoose)

mongoose.connect('mongodb://localhost/testKlasaGrupa')

var Operations = require("./database/Operations.js")
var db;

var opers = new Operations();

var currentUser;
var loggedUsers = [];

function connectToMongo() {

  db = mongoose.connection;

  //przy wystąpieniu błędu

  db.on("error", function() {
    console.log("problem z mongo")
  });

  //przy poprawnym połączeniu z bazą

  db.once("open", function() {
    console.log("mongo jest podłączone - można wykonywać operacje na bazie");
  });

  //przy rozłączeniu z bazą

  db.once("close", function() {
    console.log("mongodb zostało odłączone");
  });
}

connectToMongo();

// delet old users on start 
opers.DeleteAll(Models.User)

// Create admin on start
// Temporarily has user previgles (is part of User shema)
function createAdmin() {

  var admin = new Models.User({
    name: "admin",
    password: "admin"
  });

  opers.AddUser(Models.User, admin, function(text) {
    // Then we send it back to client
    //   io.sockets.to(socket.id).emit("user/register", {
    //     status: text
    //   });)
  })
}
createAdmin();

io.on('connection', function(socket) {
  console.log('a user connected');
  // console.log("CURRENT ID connection: ", socket.id)

  // REGISTER
  socket.on("user/register", data => {
    console.log("register data: ", data)

    // console.log("emit to " + socket.id)

    var user = new Models.User({
      name: data.name,
      password: data.password
    });

    user.validate(function(err) {
      console.log("err:", err);
    });

    opers.AddUser(Models.User, user, function(data) {
      // Then we send it back to client
      io.sockets.to(socket.id).emit("user/register", data);
    });
  })

  // LOGGING
  socket.on("user/login", userData => {
    console.log("login data: ", userData)



    // console.log("loggedusers", loggedUsers)
    // TODO Figure if below can be written easier with that if below
    var userAlreadyLogged = false;
    for (let value of loggedUsers) {
      if (value.name == userData.name) {
        userAlreadyLogged = true;
      }
    }
    console.log("user is already logged:", userAlreadyLogged)
    if (!userAlreadyLogged /*!loggedUsers.includes(userData.name)*/ ) {
      opers.ValidateUser(Models.User, userData.name, userData.password).then(data => {
        console.log(data)
        io.sockets.to(socket.id).emit("user/login", data);

        // Set the user that builds
        currentUser = userData.name;
        let loggedUser = {
          name: userData.name,
          id: socket.id
        }
        loggedUsers.push(loggedUser)

        console.log("obecnie zalogowani uzytwkonicy: ", loggedUsers)

        // send users buildings
        opers.SelectUserProjects(Models.Project, currentUser).then((response) => {
          console.log("udalo sie znalzezc projekty. RESPONSE:", response)
          io.sockets.to(socket.id).emit("user/projects", response.data);

        }).catch(response => {
          console.log("Nie udalo sie znalezc projektow", response)
          io.sockets.to(socket.id).emit("user/projects", response);

        })
      }).catch(data => {
        console.log(data)
        io.sockets.to(socket.id).emit("user/login", data);
      })

    } else {
      let data = {
        succes: false,
        text: "User is already logged"
      }
      io.sockets.to(socket.id).emit("user/login", data);
    }

  })


  // BUILDINGs
  // socket.on("block/add", data => {
  //   console.log(data)
  //   socket.broadcast.emit("block/add", data)
  // })
  // socket.on("block/change-color", data => {
  //   console.log(data)
  //   socket.broadcast.emit("block/change-color", data)
  // })

  // socket.on("block/change-size", data => {
  //   console.log(data)
  //     // io.sockets.emit("block/change-size", data)
  //   socket.broadcast.emit("block/change-size", data)
  // })

  // socket.on("block/change-rotation", data => {
  //   console.log(data)
  //   socket.broadcast.emit("block/change-rotation", data)
  // })

  // save suer Project
  socket.on("project/save", data => {
    console.log("save : ", data)
    console.log("user : ", currentUser)
      // save in db

    let project = new Models.Project({
      login: currentUser,
      buildings: data
    });

    project.validate(function(err) {
      console.log("err:", err);
    });

    opers.SaveProject(project).then((response) => {
      console.log("after saving success:", response)
      io.sockets.to(socket.id).emit("project/save", response);

    }).catch((response) => {
      console.log("after saving fail:", response)
      io.sockets.to(socket.id).emit("project/save", response);

    })

    // comment this or not?
    // socket.broadcast.emit("project/save", data)
  })


  socket.on("disconnect", function() {
    console.log("klient się rozłącza")

    console.log("CURRENT ID: ", socket.id)

    // Removing disconnecting user from loggedUsers []
    let disconnectedUser;
    for (let value of loggedUsers) {
      if (value.id == socket.id) {
        console.log("rozlaczyl sie user", value.name)
        disconnectedUser = value.name;
      }
    }
    let index = loggedUsers.indexOf(disconnectedUser);
    loggedUsers.splice(index, 1)
    console.log("obecnie zalogowani uzytwkonicy: ", loggedUsers)
  })
});

app.use(express.static('static'))