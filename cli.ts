import {
  createDeleteRequest,
  createGetRequest,
  createHandshakeRequest,
  createSetRequest,
  parseResponse,
} from "./binary_protocol.ts";
import * as net from "node:net";
import process from "node:process";
import { parseArgs } from "@std/cli";

class ClientOptions {
  port: number;

  constructor(port: number) {
    this.port = port;
  }
}

function getArgsFromCLI(): {
  options: ClientOptions;
  cmd: string;
  params: string[];
} {
  const args = parseArgs(Deno.args, {
    alias: { p: "port" },
    default: { port: 12345 },
  });

  if (args._.length < 1) {
    console.error("Usage: cli [OPTIONS] <COMMAND> [args...]");
    console.error("OPTIONS: --port | -p <port>");
    process.exit(1);
  }

  const stringifiedArgs = args._.map((arg) => arg.toString());
  const [cmd, ...params] = stringifiedArgs;
  return {
    options: new ClientOptions(args.port),
    cmd: cmd.toUpperCase(),
    params,
  };
}

function sendRequest(options: ClientOptions, cmdBuffer: Uint8Array): void {
  const client = net.createConnection({ port: options.port }, () => {
    client.write(cmdBuffer);
  });

  client.on("data", (data) => {
    const response = parseResponse(data);
    console.log(JSON.stringify(response));
    client.end();
  });

  client.on("error", (err) => {
    console.error("Error:", err);
    client.end();
  });
}

const { options, cmd, params } = getArgsFromCLI();

let request: Uint8Array;
try {
  switch (cmd) {
    case "GET":
      if (params.length !== 1) {
        console.error("Usage: cli GET <entity_name>");
        process.exit(1);
      }
      request = createGetRequest(params[0]);
      break;

    case "SET":
      if (params.length !== 2) {
        console.error("Usage: cli SET <entity_name> <entity_value>");
        process.exit(1);
      }
      request = createSetRequest(params[0], params[1]);
      break;

    case "DELETE":
      if (params.length !== 1) {
        console.error("Usage: cli DELETE <entity_name>");
        process.exit(1);
      }
      request = createDeleteRequest(params[0]);
      break;

    case "HANDSHAKE":
      request = createHandshakeRequest();
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

sendRequest(options, request);
