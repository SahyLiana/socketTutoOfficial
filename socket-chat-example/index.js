//#1 PROJECT INITIALIZATION
const express = require("express");
const { createServer } = require("node:http");

//#9 SCALE HORIZONTAL INSTAL @ npm install @socket.io/cluster-adapter

//#2 SERVING HTML
const { join } = require("node:path");

//#3 INTEGRATING SOCKET.IO
const { Server } = require("socket.io");

//#7 SERVER DELIVERY
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

//#9 SCALE HORIZONTALLY
const { availableParallelism } = require("node:os");
const cluster = require("node:cluster");
const { createAdapter, setupPrimary } = require("@socket.io/cluster-adapter");

//#9 SCALE HORIZONTALLY
if (cluster.isPrimary) {
  const numCPUs = availableParallelism();

  console.log("numCpus", numCPUs);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork({
      PORT: 3000 + i,
    });
  }

  //set up the adapter on the primary thread
  return setupPrimary();
}

//#7 SERVER DELIVERY
async function main() {
  //open the database file
  const db = await open({
    filename: "chat.db",
    driver: sqlite3.Database,
  });

  //create our 'messages' table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_offset TEXT UNIQUE,
    content TEXT)`);
  const app = express();
  const server = createServer(app);
  const io = new Server(
    server,
    //#6 CONNECTION STATE RECOVERY
    {
      connectionStateRecovery: {},

      //#9 SCALE HORIZONTALLY
      //set up the adapter on each worker thread
      adapter: createAdapter(),
    }
  );

  //#8 SCALE HORIZONTALLY
  //each worker will listen on a distinct port
  const port = process.env.PORT;

  //#1 PROJECT INITIALIZATION
  app.get("/", (req, res) => {
    // res.send("<h1>Hello world</h1>");
    console.log(join(__dirname, "index.html"));

    //#2 SERVING HTML
    res.sendFile(join(__dirname, "index.html"));
  });

  //#3 INTEGRATING SOCKET.IO
  io.on("connection", async (socket) => {
    console.log("a user connected");

    //#3 INTEGRATING SOCKET.IO
    // socket.on("disconnect", () => {
    //   console.log("user disconnected");
    // });

    //#4 EMMITING EVENTS
    // socket.on("chat message", async (msg) => {

    //#8 CLIENT DELIVERY
    socket.on("chat message", async (msg, clienOffset, callback) => {
      console.log("message:" + msg);

      //#5 BROADCASTING
      // io.emit("chat message", msg);

      //#7 SERVER DELIVERY
      let result;
      try {
        // result = await db.run("INSERT INTO messages (content) VALUES (?)", msg);

        //#8 CLIENT DELIVERY
        result = await db.run(
          "INSERT INTO messages (content, client_offset) VALUES (?, ?)",
          msg,
          clienOffset
        );
      } catch (e) {
        console.log(e);

        //#8 CLIENT DELIVERY
        if (e.errno === 19 /* SQLITE_CONSTRAINT*/) {
          //the message was already inserted, so we notify the client
          callback();
        } else {
          //noting to do, just let the client retry
        }

        return;
      }

      //#7 SERVER DELIVERY
      //include the offset with the message
      io.emit("chat message", msg, result.lastID);

      //#8 CLIENT DELIVERY
      //acknowledge the event
      callback();
    });

    //#7 SERVER DELIVERY
    if (!socket.recovered) {
      //if the connection state recovery was not successful
      console.log("socket.recovery");
      try {
        console.log("inside try block socket.recovery");
        await db.each(
          "SELECT id, content FROM messages WHERE id > ?",
          [socket.handshake.auth.serverOffset || 0],
          (_err, row) => {
            socket.emit("chat message", row.content, row.id);
          }
        );
      } catch (e) {
        console.log(error);
      }
    }
  });
  // #1 PROJECT INITIALIZATION
  // server.listen(3000, () => {
  //   console.log("Server running at http://localhost:3000");
  // });

  //#9 SCALE HORIZONTALLY
  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

main();
