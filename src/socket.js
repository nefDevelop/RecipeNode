const { Server } = require("socket.io");

let io;

function init(httpServer) {
  // Sin dominio aún: solo mismo origen. Para proxy con dominio,
  // definir CORS_ORIGIN=https://tu-dominio.
  const corsOrigin = process.env.CORS_ORIGIN || false;
  io = new Server(httpServer, {
    cors: corsOrigin
      ? {
          origin: corsOrigin.split(",").map((s) => s.trim()),
          methods: ["GET", "POST"],
        }
      : undefined,
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
