import { parseArgs } from "@std/cli";
import * as server from "./server.ts";

function main() {
  const args = parseArgs(Deno.args, {
    default: { port: 12345 },
    alias: { p: "port" },
  });

  server.init(new server.ServerOptions(args.port));
}

if (import.meta.main) {
  main();
}
