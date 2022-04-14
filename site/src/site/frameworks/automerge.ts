import { SyncFramework } from "../sync_framework";
import Automerge from "automerge";
import ReconnectingWebSocket from "reconnecting-websocket";
import { Buffer } from "buffer";

export class AutomergeFramework extends SyncFramework {
  private doc: Automerge.FreezeObject<{
    drawing1: { [id: string]: { [prop: string]: unknown } };
  }>;
  private readonly wsNetwork: AutomergeWebSocketNetwork;

  constructor(wsURL: string) {
    super();

    this.doc = Automerge.init();

    this.wsNetwork = new AutomergeWebSocketNetwork(
      this.receive.bind(this),
      wsURL,
      ""
    );
  }

  private transact(doOps: () => void): void {
    const oldDoc = this.doc;
    doOps();
    // TODO: can we use Automerge.getLastLocalChange instead?
    // Docs say it should be faster, but it's possible doOps
    // does multiple changes.
    const msg = Automerge.getChanges(oldDoc, this.doc);
    this.wsNetwork.send(msg);
  }

  private receive(msg: Automerge.BinaryChange[]): void {
    const ans = Automerge.applyChanges(this.doc, msg);
    this.doc = ans[0];

    const diffs = ans[1].diffs.props.drawing1;
    for (const diff of Object.values(diffs)) {
      const mapEdit = <Automerge.MapDiff>diff;
      for (const key of Object.keys(mapEdit.props)) {
        this.notifyObjectChangedKey(key);
      }
    }
  }

  private notifyObjectChangedKey(key: string) {
    this.notifyObjectChanged(key, this.doc.drawing1[key]);
  }

  protected addObject(id: string, obj: any): void {
    this.transact(() => {
      this.doc = Automerge.change(this.doc, (doc) => {
        if (doc.drawing1 === undefined) {
          doc.drawing1 = {};
        }
        doc.drawing1[id] = obj;
      });
    });
    this.notifyObjectChangedKey(id);
  }

  protected updateObject(id: string, obj: any): void {
    this.transact(() => {
      this.doc = Automerge.change(this.doc, (doc) => {
        const objMap = doc.drawing1[id]!;
        // Only set properties that actually changed.
        for (const [key, value] of Object.entries(obj)) {
          if (value !== objMap[key]) {
            objMap[key] = value;
          }
        }
      });
    });
    this.notifyObjectChangedKey(id);
  }

  protected removeObject(id: string): void {
    this.transact(() => {
      this.doc = Automerge.change(this.doc, (doc) => {
        delete doc.drawing1[id];
      });
    });
  }
}

/**
 * Copied from @collabs/ws-client, but slightly modified
 * to work with Automerge instead.
 */
class AutomergeWebSocketNetwork {
  /**
   * Connection to the server.
   *
   * Use ReconnectingWebSocket so we don't have to worry about
   * reopening closed connections.
   */
  readonly ws: ReconnectingWebSocket;

  /**
   * [constructor description]
   * @param url The url to pass to WebSocket's constructor.
   * @param group A group name that uniquely identifies this
   * app and group of collaborators on the server.
   * (The server broadcasts messages between WebSocketNetworks
   * in the same group.)
   */
  constructor(
    private readonly onreceive: (msg: Automerge.BinaryChange[]) => void,
    url: string,
    readonly group: string
  ) {
    this.ws = new ReconnectingWebSocket(url);
    this.ws.addEventListener("message", this.wsReceive.bind(this));

    // Register with the server.
    // TODO: wait until after "loading", so we only request
    // messages we need, and also this won't start delivering
    // messages before the user signals that the app is ready.
    // Make sure server won't give us *any* messages (even new
    // ones) until after registration, or if it does, we queue them.
    const register = JSON.stringify({
      type: "register",
      group: group,
    });
    this.ws.send(register);
  }

  /**
   * this.ws "message" event handler.
   */
  private wsReceive(e: MessageEvent) {
    // Opt: use Uint8Array directly instead
    // (requires changing options + server)
    // See https://stackoverflow.com/questions/15040126/receiving-websocket-arraybuffer-data-in-the-browser-receiving-string-instead
    let parsed = JSON.parse(e.data) as { group: string; message: string[] };
    // TODO: is this check necessary?
    if (parsed.group === this.group) {
      // It's for us
      this.onreceive(
        parsed.message.map(
          (one) =>
            new Uint8Array(Buffer.from(one, "base64")) as Automerge.BinaryChange
        )
      );
    }
  }

  /**
   * this.app "Send" event handler.
   */
  send(msg: Automerge.BinaryChange[]): void {
    let encoded = msg.map((one) => Buffer.from(one).toString("base64"));
    let toSend = JSON.stringify({ group: this.group, message: encoded });
    // Opt: use Uint8Array directly instead
    // (requires changing options + server)
    // See https://stackoverflow.com/questions/15040126/receiving-websocket-arraybuffer-data-in-the-browser-receiving-string-instead
    this.ws.send(toSend);
  }
}
