import { SyncFramework } from "../sync_framework";
import {
  CObject,
  CRDTApp,
  DeletingMutCMap,
  InitToken,
  LWWCMap,
  Optional,
  Pre,
} from "@collabs/collabs";
import { WebSocketNetwork } from "@collabs/ws-client";

class ShapeObj extends CObject {
  readonly map: LWWCMap<string, unknown>;

  constructor(initToken: InitToken) {
    super(initToken);

    this.map = this.addChild("", Pre(LWWCMap)());
  }
}

class Drawing extends CObject {
  readonly shapes: DeletingMutCMap<string, ShapeObj, []>;

  constructor(initToken: InitToken) {
    super(initToken);

    this.shapes = this.addChild(
      "",
      Pre(DeletingMutCMap)((valueInitToken) => new ShapeObj(valueInitToken))
    );
  }
}

export class CollabsFramework extends SyncFramework {
  private readonly drawing1: Drawing;

  constructor(wsURL: string) {
    super();

    // Causality guaranteed by use of a central server.
    const app = new CRDTApp({ causalityGuaranteed: true });
    this.drawing1 = app.registerCollab("drawing1", Pre(Drawing)());
    app.load(Optional.empty());

    new WebSocketNetwork(app, wsURL, "");

    this.drawing1.shapes.on("Set", (e) => {
      // Handle in a promise so the rest of the transaction
      // goes through first.
      Promise.resolve().then(() => {
        this.drawing1.shapes
          .get(e.key)!
          .map.on("Any", () => this.notifyObjectChangedKey(e.key));
        this.notifyObjectChangedKey(e.key);
      });
    });
    // notifyObjectChanged doesn't appear to handle deletes,
    // and they are not called by the robot, so just
    // ignore them.
  }

  private notifyObjectChangedKey(key: string) {
    this.notifyObjectChanged(
      key,
      Object.fromEntries(this.drawing1.shapes.get(key)!.map.entries())
    );
  }

  protected addObject(id: string, obj: any): void {
    const shape = this.drawing1.shapes.set(id);
    // Set properties separately so they can be edited
    // independently.
    for (const [key, value] of Object.entries(obj)) {
      shape.map.set(key, value);
    }
  }

  protected updateObject(id: string, obj: any): void {
    const shape = this.drawing1.shapes.get(id)!;
    // Only set properties that actually changed.
    for (const [key, value] of Object.entries(obj)) {
      if (value !== shape.map.get(key)) {
        shape.map.set(key, value);
      }
    }
  }

  protected removeObject(id: string): void {
    this.drawing1.shapes.delete(id);
  }
}
