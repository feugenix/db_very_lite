import { createGetRequest, parseResponse } from "./binary_protocol.ts";
import * as net from "node:net";

const client = net.createConnection({ port: 12345 }, () => {
  const request = createGetRequest("example");
  client.write(request);
});

client.on("data", (data) => {
  const response = parseResponse(data);
  console.log("Response from server:", response);
  client.end();
});
