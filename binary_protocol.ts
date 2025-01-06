import { concat } from "@std/bytes";

const PROTOCOL_VERSION = 0x01; // Current protocol version

// Command codes
const COMMANDS = {
  GET: 0x01,
  SET: 0x02,
  DELETE: 0x03,
} as const;

type Command = keyof typeof COMMANDS;

// Status codes
const STATUS = {
  SUCCESS: 0x00,
  FAILURE: 0x01,
} as const;

type Status = keyof typeof STATUS;

function encodeString(value: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(value + "\0"); // Null-terminated string always marks the end of the value
}

function decodeString(buffer: Uint8Array): string {
  const decoder = new TextDecoder();
  const nullIndex = buffer.lastIndexOf(0);
  return decoder.decode(
    buffer.subarray(0, nullIndex === -1 ? buffer.length : nullIndex),
  );
}

function assertProtocolVersion(version: number) {
  if (version !== PROTOCOL_VERSION) {
    throw new Error(
      `Invalid protocol version, expected ${PROTOCOL_VERSION} but got ${version}`,
    );
  }
}

function assertPayloadLength(raw_payload: Uint8Array, len: number) {
  if (raw_payload.length !== len) {
    throw new Error(
      `Invalid payload length, expected ${len} but got ${raw_payload.length}`,
    );
  }
}

function getCommandName(cmdCode: number) {
  const cmd = (Object.keys(COMMANDS) as Command[]).find((key) =>
    COMMANDS[key] === cmdCode
  );

  if (!cmd) {
    throw new Error("Invalid command code");
  }

  return cmd;
}

function getStatusName(statusCode: number) {
  const status = (Object.keys(STATUS) as Status[]).find((key) =>
    STATUS[key] === statusCode
  );

  if (!status) {
    throw new Error("Invalid status code");
  }

  return status;
}

class ProtocolMessage {
  static encodeRequest(cmd: Command, payload: Uint8Array): Uint8Array {
    const len = payload.length;
    const buffer = new Uint8Array(3 + len);
    buffer[0] = PROTOCOL_VERSION;
    buffer[1] = COMMANDS[cmd];
    buffer[2] = len;
    buffer.set(payload, 3);
    return buffer;
  }

  static decodeRequest(
    buffer: Uint8Array,
  ): { cmd: Command; payload: string } {
    assertProtocolVersion(buffer[0]);

    const cmdCode = buffer[1];
    const cmd = getCommandName(cmdCode);

    const len = buffer[2];
    const raw_payload = buffer.subarray(3);
    assertPayloadLength(raw_payload, len);
    const payload = decodeString(raw_payload);

    return { cmd, payload };
  }

  static encodeResponse(status: Status, payload: Uint8Array): Uint8Array {
    const len = payload.length;
    const buffer = new Uint8Array(3 + len);
    buffer[0] = PROTOCOL_VERSION;
    buffer[1] = STATUS[status];
    buffer[2] = len;
    buffer.set(payload, 3);
    return buffer;
  }

  static decodeResponse(
    buffer: Uint8Array,
  ): { status: Status; payload: Uint8Array } {
    assertProtocolVersion(buffer[0]);

    const statusCode = buffer[1];

    const status = getStatusName(statusCode);

    const len = buffer[2];
    const payload = buffer.subarray(3);
    assertPayloadLength(payload, len);

    return { status, payload };
  }
}

function createGetRequest(entityName: string): Uint8Array {
  return ProtocolMessage.encodeRequest("GET", encodeString(entityName));
}

function createSetRequest(entityName: string, entityValue: string): Uint8Array {
  const name = encodeString(entityName);
  const value = encodeString(entityValue);
  return ProtocolMessage.encodeRequest(
    "SET",
    concat([name, value]),
  );
}

function createDeleteRequest(entityName: string): Uint8Array {
  return ProtocolMessage.encodeRequest("DELETE", encodeString(entityName));
}

function parseResponse(
  buffer: Uint8Array,
): { status: string; payload: string } {
  const { status, payload } = ProtocolMessage.decodeResponse(buffer);
  return {
    status: status === "SUCCESS" ? "SUCCESS" : "FAILURE",
    payload: decodeString(payload),
  };
}

function encodeResponse(status: Status, payload?: string): Uint8Array {
  if (payload === undefined) {
    return ProtocolMessage.encodeResponse(status, new Uint8Array());
  } else {
    return ProtocolMessage.encodeResponse(status, encodeString(payload));
  }
}

export {
  COMMANDS,
  createDeleteRequest,
  createGetRequest,
  createSetRequest,
  encodeResponse,
  parseResponse,
  ProtocolMessage,
  STATUS,
};
