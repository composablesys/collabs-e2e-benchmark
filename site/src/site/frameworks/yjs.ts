import { SyncFramework } from "../sync_framework";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

export class YjsFramework extends SyncFramework {
  private readonly doc: Y.Doc;
  private readonly drawing1: Y.Map<Y.Map<unknown>>;

  constructor(wsURL: string) {
    super();

    this.doc = new Y.Doc();
    this.drawing1 = this.doc.getMap("drawing1");

    new WebsocketProvider(wsURL, "", this.doc);

    this.drawing1.observe((event) =>
      event.keys.forEach((change, key) => {
        if (change.action === "add") {
          this.notifyObjectChangedKey(key);
          this.drawing1.get(key)!.observe(() => {
            this.notifyObjectChangedKey(key);
          });
        }
        // notifyObjectChanged doesn't appear to handle deletes,
        // and they are not called by the robot, so just
        // ignore them.
      })
    );
  }

  private notifyObjectChangedKey(key: string) {
    console.log("notifying: " + key);
    this.notifyObjectChanged(
      key,
      Object.fromEntries(this.drawing1.get(key)!.entries())
    );
  }

  protected addObject(id: string, obj: any): void {
    console.log("add: " + id + "," + JSON.stringify(obj));
    this.doc.transact(() => {
      const objMap = new Y.Map<unknown>();
      this.drawing1.set(id, objMap);
      // Set properties separately so they can be edited
      // independently.
      for (const [key, value] of Object.entries(obj)) {
        objMap.set(key, value);
      }
    });
  }

  protected updateObject(id: string, obj: any): void {
    const objMap = this.drawing1.get(id)!;
    this.doc.transact(() => {
      // Only set properties that actually changed.
      for (const [key, value] of Object.entries(obj)) {
        if (value !== objMap.get(key)) {
          objMap.set(key, value);
        }
      }
    });
  }

  protected removeObject(id: string): void {
    this.drawing1.delete(id);
  }
}
