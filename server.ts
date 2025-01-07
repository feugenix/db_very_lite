import * as net from "node:net";
import { encodeResponse, ProtocolMessage } from "./binary_protocol.ts";
import { SSTablesList, SSTablesListOptions } from "./sstables.ts";

const DEFAULT_PORT = 12345;

class ServerOptions {
  port: number;

  constructor(port: number = DEFAULT_PORT) {
    this.port = port;
  }
}

let store: SSTablesList | null = null;

const server = net.createServer((socket) => {
  socket.on("data", (data) => {
    if (!store) {
      console.error("Store is not initialized");
      return;
    }

    try {
      const { cmd, payload } = ProtocolMessage.decodeRequest(data);

      switch (cmd) {
        case "GET": {
          const entityName = payload;
          const value = store.get(entityName) || "NONE";
          console.log("GET", entityName, value);
          const response = encodeResponse("SUCCESS", value);
          socket.write(response);
          break;
        }
        case "SET": {
          const parts = payload.split("\0");
          console.log(`SET, payload = ${payload}, parts = ${parts}`);
          const [entityName, entityValue] = parts;
          store.set(entityName, entityValue);
          console.log(
            `SET, entityName = ${entityName}, entityValue = ${entityValue}`,
          );

          socket.write(encodeResponse("SUCCESS"));
          break;
        }
        case "DELETE": {
          const entityName = payload;
          console.log("DELETE", entityName);
          store.delete(entityName);

          socket.write(encodeResponse("SUCCESS"));
          break;
        }
        case "HANDSHAKE": {
          console.log("HANDSHAKE");
          socket.write(encodeResponse("SUCCESS"));
          break;
        }
      }
    } catch (err) {
      console.error("Error handling request:", err);

      try {
        socket.write(encodeResponse("FAILURE"));
      } catch (err) {
        console.error("Error sending failure response:", err);
      }
    }
  });
});

function handleExit() {
  try {
    if (store) {
      console.log("Closing server");
      server.close();

      console.log("Flushing memtable");
      store.flushMemTableConditionally();
    }
  } finally {
    Deno.exit();
  }
}

function init(options: ServerOptions) {
  store = new SSTablesList(new SSTablesListOptions());

  Deno.addSignalListener("SIGINT", handleExit);

  server.listen(options.port, () => {
    console.log(`Server listening on port ${options.port}`);
  });
}

export { init, ServerOptions };
