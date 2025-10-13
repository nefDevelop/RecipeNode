const { Server } = require("socket.io");

let io;

function init(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: "*", // TODO: Adjust for production
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log("A user connected with socket ID:", socket.id);

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
}

module.exports = {
  init,
  getIO,
};
