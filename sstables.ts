import * as fs from "node:fs";
import * as path from "node:path";

const DEFAULT_DATA_DIR = "data/";
const DEFAULT_MAX_ENTITIES_NUMBER = 100;

class LinkedListNode<T> {
  next: LinkedListNode<T> | undefined;
  prev: LinkedListNode<T> | undefined;

  constructor(public value: T) {}

  insertAfter(value: T) {
    const list_node = new LinkedListNode(value);

    if (this.next) {
      this.next.prev = list_node;
      list_node.next = this.next;
    }

    list_node.prev = this;
    this.next = list_node;
  }

  insertBefore(value: T) {
    const list_node = new LinkedListNode(value);

    if (this.prev) {
      this.prev.next = list_node;
      list_node.prev = this.prev;
    }

    list_node.next = this;
    this.prev = list_node;
  }
}

class LinkedList<T> {
  private head: LinkedListNode<T> | undefined;
  private tail: LinkedListNode<T> | undefined;

  constructor(values: T[] | undefined) {
    if (values) {
      this.head = new LinkedListNode(values[0]);
      this.tail = this.head;

      for (let i = 1; i < values.length; i++) {
        this.append(values[i]);
      }
    }
  }

  insertAfterHead(value: T) {
    if (!this.head) {
      this.head = new LinkedListNode(value);
    } else {
      this.head.insertAfter(value);
    }
  }

  append(value: T) {
    if (!this.tail) {
      this.tail = new LinkedListNode(value);
    } else {
      this.tail.insertAfter(value);
      this.tail = this.tail.next;
    }
  }

  prepend(value: T) {
    if (!this.head) {
      this.head = new LinkedListNode(value);
    } else {
      this.head.insertBefore(value);
      this.head = this.head.prev;
    }
  }

  forEach(cb: (item: T) => boolean) {
    let current_node = this.head;
    while (current_node) {
      if (!cb(current_node.value)) {
        break;
      }

      current_node = current_node.next;
    }
  }
}

interface PartialEntityList {
  get(key: string): KeyMetadata | null;
  set(key: string, value: string): void;
  get size(): number;
}

class KeyMetadata {
  public data: string;
  public isDeleted: boolean = false;

  constructor(data: string, isDeleted: boolean = false) {
    this.data = data;
    this.isDeleted = isDeleted;
  }
}

class MemoryTable implements PartialEntityList {
  public data: Map<string, KeyMetadata> = new Map();

  set(key: string, value: string): void {
    const item = this.data.get(key);
    if (item && item.isDeleted) {
      return;
    }

    this.data.set(key, new KeyMetadata(value));
  }

  get(key: string): KeyMetadata | null {
    const item = this.data.get(key);
    if (!item || item.isDeleted) {
      return null;
    }

    return item;
  }

  delete(key: string): void {
    const item = this.data.get(key);

    if (!item) {
      this.data.set(key, new KeyMetadata("", true));
    } else {
      item.isDeleted = true;
    }
  }

  get size(): number {
    return this.data.size;
  }

  flushToSSTable(filename: string): SSTable | null {
    const sortedEntries = Array.from(this.data.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );

    if (sortedEntries.length === 0) {
      return null;
    }

    const sstable = new SSTable(filename, sortedEntries);
    sstable.writeToDisk();

    this.data.clear();
    return sstable;
  }
}

class SSTable implements PartialEntityList {
  private filename: string;
  private entries: [string, KeyMetadata][];
  private index: Map<string, number> = new Map(); // In-memory index for quick lookups

  constructor(filename: string, entries: [string, KeyMetadata][]) {
    this.filename = filename;
    this.entries = entries;

    this.buildIndex();
  }

  private buildIndex() {
    this.entries.forEach(([key], idx) => {
      this.index.set(key, idx);
    });
  }

  writeToDisk(): void {
    const filePath = path.resolve(this.filename);
    const fileData = JSON.stringify(this.entries);
    fs.writeFileSync(filePath, fileData, "utf-8");
  }

  readFromDisk(): void {
    const filePath = path.resolve(this.filename);
    const fileData = fs.readFileSync(filePath, "utf-8");
    this.entries = JSON.parse(fileData) as [string, KeyMetadata][];
    this.index.clear();
    this.buildIndex();
  }

  get(key: string): KeyMetadata | null {
    console.log("GET", key);
    const index = this.index.get(key);
    if (index === undefined) {
      console.log("GET not found", key);
      return null;
    }

    const item = this.entries[index][1];
    console.log("GET found", key, item);

    return item;
  }

  set(_: string): void {
    throw Error("File SSTable is read only!");
  }

  get size(): number {
    return this.entries.length;
  }
}

class SSTablesListOptions {
  data_dir: string;
  max_entities_number: number;

  constructor(
    data_dir: string = DEFAULT_DATA_DIR,
    max_entities_number: number = DEFAULT_MAX_ENTITIES_NUMBER,
  ) {
    this.data_dir = data_dir;
    this.max_entities_number = max_entities_number;
  }
}

class SSTablesList {
  private memTable = new MemoryTable();
  private partial_entities_lists: LinkedList<PartialEntityList>;
  private data_dir: string;
  private max_entities_number: number;

  constructor(options: SSTablesListOptions) {
    this.data_dir = options.data_dir;
    this.max_entities_number = options.max_entities_number;

    if (!fs.existsSync(this.data_dir)) {
      fs.mkdirSync(this.data_dir);
    }

    this.partial_entities_lists = new LinkedList<PartialEntityList>([
      this.memTable,
    ]);
    this.readFromDisk();
  }

  set(key: string, value: string): void {
    this.memTable.set(key, value);

    this.flushMemTableConditionally();
  }

  delete(key: string): void {
    this.memTable.delete(key);

    this.flushMemTableConditionally();
  }

  public flushMemTableConditionally() {
    if (this.memTable.size < this.max_entities_number) {
      return;
    }

    const file_path = path.resolve(
      this.data_dir,
      `sstable-${Date.now()}.json`,
    );
    const sstable = this.memTable.flushToSSTable(file_path);
    if (!sstable) {
      return;
    }

    this.partial_entities_lists?.insertAfterHead(sstable);
  }

  private readFromDisk() {
    const files = fs.readdirSync(this.data_dir);
    // sort files so the newest ones are last and will be inserted in the beginning of the list
    files.sort();

    files.forEach((file) => {
      const sstable = new SSTable(path.resolve(this.data_dir, file), []);
      sstable.readFromDisk();
      this.partial_entities_lists.insertAfterHead(sstable);
    });
  }

  get(key: string): string | null {
    let result: KeyMetadata | undefined;
    // Check SSTables in reverse order (memtable is the first and newest tables on disk come first)
    this.partial_entities_lists.forEach((entities_list) => {
      const entity = entities_list.get(key);
      console.log("SSTablesList.get", key, entity);

      if (entity != null) {
        result = entity;
        return false;
      }

      return true;
    });

    if (result != undefined && !result.isDeleted) {
      return result.data;
    }

    return null;
  }
}

export { SSTablesList, SSTablesListOptions };
