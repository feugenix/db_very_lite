import {
  createDeleteRequest,
  createGetRequest,
  createSetRequest,
  encodeResponse,
  parseResponse,
  ProtocolMessage,
} from "./binary_protocol.ts";
import { assertEquals, assertThrows } from "jsr:@std/assert";

Deno.test("createGetRequest creates a valid request", () => {
  const entityName = "Entity";
  const request = createGetRequest(entityName);

  const decoded = ProtocolMessage.decodeRequest(request);
  assertEquals(decoded.cmd, "GET");
  assertEquals(decoded.payload, entityName);
});

Deno.test("createSetRequest creates a valid request", () => {
  const entityName = "Entity";
  const entityValue = "Value";
  const request = createSetRequest(entityName, entityValue);

  const decoded = ProtocolMessage.decodeRequest(request);
  assertEquals(decoded.cmd, "SET");
  assertEquals(decoded.payload, `${entityName}\0${entityValue}`);
});

Deno.test("createDeleteRequest creates a valid request", () => {
  const entityName = "Entity";
  const request = createDeleteRequest(entityName);

  const decoded = ProtocolMessage.decodeRequest(request);
  assertEquals(decoded.cmd, "DELETE");
  assertEquals(decoded.payload, entityName);
});

Deno.test("encodeResponse creates a valid response and parseResponse parses responses correctly", () => {
  const status = "SUCCESS";
  const payload = "ResponsePayload";
  const response = encodeResponse(status, payload);

  const decoded = parseResponse(response);
  assertEquals(decoded.status, status);
  assertEquals(decoded.payload, payload);
});

Deno.test("decodeRequest throws error on invalid protocol version", () => {
  const invalidBuffer = new Uint8Array([0x02, 0x01, 0x00]);
  assertThrows(
    () => ProtocolMessage.decodeRequest(invalidBuffer),
    Error,
    "Invalid protocol version",
  );
});

Deno.test("decodeRequest throws error on invalid command code", () => {
  const invalidBuffer = new Uint8Array([0x01, 0xff, 0x00]);
  assertThrows(
    () => ProtocolMessage.decodeRequest(invalidBuffer),
    Error,
    "Invalid command code",
  );
});

Deno.test("decodeResponse throws error on invalid protocol version", () => {
  const invalidBuffer = new Uint8Array([0x02, 0x00, 0x00]);
  assertThrows(
    () => ProtocolMessage.decodeResponse(invalidBuffer),
    Error,
    "Invalid protocol version",
  );
});

Deno.test("decodeResponse throws error on invalid status code", () => {
  const invalidBuffer = new Uint8Array([0x01, 0xff, 0x00]);
  assertThrows(
    () => ProtocolMessage.decodeResponse(invalidBuffer),
    Error,
    "Invalid status code",
  );
});

Deno.test("decodeRequest throws error on invalid payload length", () => {
  const invalidBuffer = new Uint8Array([0x01, 0x01, 0x02, 0x41]);
  assertThrows(
    () => ProtocolMessage.decodeRequest(invalidBuffer),
    Error,
    "Invalid payload length",
  );
});

Deno.test("decodeResponse throws error on invalid payload length", () => {
  const invalidBuffer = new Uint8Array([0x01, 0x00, 0x02, 0x41]);
  assertThrows(
    () => ProtocolMessage.decodeResponse(invalidBuffer),
    Error,
    "Invalid payload length",
  );
});
