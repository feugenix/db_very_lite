import * as net from "node:net";
import { encodeResponse, ProtocolMessage } from "./binary-protocol.ts";
import { SSTablesList } from "./sstables.ts";

let store: SSTablesList | null = null;

const server = net.createServer((socket) => {
  socket.on("data", (data) => {
    if (!store) {
      console.error("Store not initialized");
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
      }
    } catch (err) {
      console.error("Error handling request:", err);
    }
  });
});

function handleExit() {
  try {
    if (store) {
      console.log("Closing server");
      server.close();

      console.log("Flushing memtable");
      store.flushMemTable();
    }
  } finally {
    Deno.exit();
  }
}

function main() {
  store = new SSTablesList();

  Deno.addSignalListener("SIGINT", handleExit);

  server.listen(12345, () => {
    console.log("Server listening on port 12345");
  });
}

if (import.meta.main) {
  main();
}
