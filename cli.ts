import {
  createDeleteRequest,
  createGetRequest,
  createSetRequest,
  parseResponse,
} from "./binary_protocol.ts";
import * as net from "node:net";
import process from "node:process";

function parseArgs(): { cmd: string; params: string[] } {
  const args = process.argv.slice(2); // Exclude "node" and script name
  if (args.length < 1) {
    console.error("Usage: cli-client <COMMAND> [args...]");
    process.exit(1);
  }

  const [cmd, ...params] = args;
  return { cmd: cmd.toUpperCase(), params };
}

function sendRequest(cmdBuffer: Uint8Array): void {
  const client = net.createConnection({ port: 12345 }, () => {
    client.write(cmdBuffer);
  });

  client.on("data", (data) => {
    const response = parseResponse(data);
    console.log(JSON.stringify(response));
    client.end();
  });

  client.on("error", (err) => {
    console.error("Error:", err.message);
    client.end();
  });
}

const { cmd, params } = parseArgs();

let request: Uint8Array;
try {
  switch (cmd) {
    case "GET":
      if (params.length !== 1) {
        console.error("Usage: cli-client GET <entity_name>");
        process.exit(1);
      }
      request = createGetRequest(params[0]);
      break;

    case "SET":
      if (params.length !== 2) {
        console.error("Usage: cli-client SET <entity_name> <entity_value>");
        process.exit(1);
      }
      request = createSetRequest(params[0], params[1]);
      break;

    case "DELETE":
      if (params.length !== 1) {
        console.error("Usage: cli-client DELETE <entity_name>");
        process.exit(1);
      }
      request = createDeleteRequest(params[0]);
      break;

    default:
      console.error("Unknown command:", cmd);
      console.error("Supported commands: GET, SET, DELETE");
      process.exit(1);
  }
} catch (err) {
  console.error("Error creating request:", err);
  process.exit(1);
}

sendRequest(request);
