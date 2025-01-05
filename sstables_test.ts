import { SSTablesList } from "./sstables.ts";

// Test Example
const ssTablesList = new SSTablesList();

// Simulate writes
ssTablesList.set("a", "apple");
ssTablesList.set("b", "banana");
ssTablesList.set("c", "cherry");
ssTablesList.set("d", "date");
ssTablesList.set("e", "elderberry");
ssTablesList.set("f", "fig");

// Simulate reads
const keys = ["a", "b", "c", "d", "e", "f", "non-existent"];
keys.forEach((key: string) => {
  console.log(`key: ${key}, value: ${ssTablesList.get(key)}`);
});
