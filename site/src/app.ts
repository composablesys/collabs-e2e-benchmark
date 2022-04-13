import "@material/mwc-button";
import fabric from "fabric/fabric-impl";
import { Circle } from "./shapes/circle";
import { Rect } from "./shapes/rect";
import { getRandomColor } from "./util/color";
import { newUUID } from "./util/uuid";

export abstract class SyncFramework {
  private readonly add: number;
  private readonly shuffle_time: number;
  private readonly shuffle_rate: number;
  private readonly shuffle_delay: number;
  private readonly shuffle_multiplier: number;
  private readonly close_time: number;

  protected readonly debug: boolean;
  protected readonly nop2p: boolean;
  protected readonly nos2p: boolean;

  protected readonly nogui: boolean;

  private readonly canvas: fabric.Canvas;

  protected readonly objects: Map<string, Rect | Circle> = new Map();

  protected constructor() {
    const searchParams = new URLSearchParams(window.location.search);

    this.add = searchParams.has("add") ? parseInt(searchParams.get("add")!) : 0;
    this.shuffle_time = searchParams.has("shuffle_time")
      ? parseInt(searchParams.get("shuffle_time")!)
      : 0;
    this.shuffle_rate = searchParams.has("shuffle_rate")
      ? parseInt(searchParams.get("shuffle_rate")!)
      : 0;
    this.shuffle_delay = searchParams.has("shuffle_delay")
      ? parseInt(searchParams.get("shuffle_delay")!)
      : 0;
    this.shuffle_multiplier = searchParams.has("shuffle_multiplier")
      ? parseInt(searchParams.get("shuffle_multiplier")!)
      : 1;
    this.close_time = searchParams.has("close_time")
      ? parseInt(searchParams.get("close_time")!)
      : 0;

    this.debug = searchParams.has("debug") || false;
    this.nop2p = searchParams.has("nop2p") || false;
    this.nos2p = searchParams.has("nos2p") || false;

    this.nogui = searchParams.has("nogui") || false;

    this.canvas = new fabric.Canvas("c");
    this.canvas.setHeight(window.innerHeight - 64);
    this.canvas.setWidth(window.innerWidth);
    this.canvas.includeDefaultValues = false;
    this.canvas.selection = false;

    this.setRemoveButton();
    this.setShuffleButton();
    document
      .getElementById("btnAddRect")!
      .addEventListener("click", () => this.addRect());
    document
      .getElementById("btnAddCircle")!
      .addEventListener("click", () => this.addCircle());

    this.canvas.on("object:modified", (evt: fabric.IEvent) => {
      const obj = evt.target as Rect | Circle;
      const doc = obj.toObject();
      const original = evt.transform!.original as any;

      for (const key of Object.keys(doc)) {
        if (original[key] != null && doc[key] !== original[key]) {
          console.log(`S ${obj.id}.${key} ${doc[key]}`);
        }
      }
      this.updateObject(obj.id, doc);
    });
  }

  public async start() {
    if (this.add > 0) {
      for (let i = 0; i < this.add; i++) {
        await this.addRect();
      }
    }

    if (this.shuffle_rate > 0 && this.shuffle_time > 0) {
      setTimeout(() => {
        const t = setInterval(() => {
          this.shuffle();
        }, this.shuffle_rate);
        setTimeout(() => {
          clearInterval(t);
        }, 1000 * this.shuffle_time);
      }, 1000 * this.shuffle_delay);
    }

    if (this.close_time > 0) {
      setTimeout(() => {
        window.location.replace("http://127.0.0.1");
      }, 1000 * this.close_time);
    }
  }

  private setRemoveButton() {
    const btnRemove = document.getElementById("btnRemove")!;
    btnRemove.addEventListener("click", () => {
      const o = this.canvas.getActiveObject() as Rect | Circle;
      this.canvas.fxRemove(o);
      this.objects.delete(o.id);
      this.removeObject(o.toObject());
    });
    this.canvas.on("selection:created", () => {
      btnRemove.removeAttribute("disabled");
    });
    this.canvas.on("selection:cleared", () => {
      btnRemove.setAttribute("disabled", "");
    });
  }

  private setShuffleButton() {
    const btnRobot = document.getElementById("btnRobot")!;
    let stop = false;
    let interval: number;
    btnRobot.addEventListener("click", () => {
      if (stop) {
        window.clearInterval(interval);
        btnRobot.innerHTML = "Start robot";
        stop = false;
      } else {
        const i = parseInt(prompt("Choose an interval in ms", "1000")!);
        if (i > 0) {
          interval = window.setInterval(() => this.shuffle(), i);
          btnRobot.innerHTML = "Stop robot";
          stop = true;
        }
      }
    });
  }

  protected shuffle() {
    for (let i_ = 0; i_ < this.shuffle_multiplier; i_++) {
      const i = Math.floor(Math.random() * this.objects.size);
      const obj = Array.from(this.objects.values())[i];

      const horizontal = this.canvas.getWidth() - obj.get("width")! - 20;
      const vertical = this.canvas.getHeight() - obj.get("height")! - 20;

      if (Math.random() > 0.5) {
        const newLeft = Math.floor(Math.random() * horizontal) + 10;
        obj.set("left", newLeft);
        console.log(`S ${obj.id}.left ${newLeft}`);
        this.updateObject(obj.id, obj.toObject());
      } else {
        const newTop = Math.floor(Math.random() * vertical) + 10;
        obj.set("top", newTop);
        console.log(`S ${obj.id}.top ${newTop}`);
        this.updateObject(obj.id, obj.toObject());
      }

      if (!this.nogui) {
        this.canvas.setActiveObject(obj);
      }
    }

    if (!this.nogui) {
      this.canvas.requestRenderAll();
    }
  }

  protected abstract addObject(id: string, obj: any): void;

  protected abstract updateObject(id: string, obj: any): void;

  protected abstract removeObject(id: string): void;

  private async addRect() {
    const rect = new Rect({
      id: await newUUID(),
      top: 100,
      left: 100,
      width: 80,
      height: 50,
      fill: getRandomColor(),
    });
    this.addObject(rect.id, rect.toObject());
  }

  private async addCircle() {
    const circle = new Circle({
      id: await newUUID(),
      top: 100,
      left: 100,
      radius: 50,
      fill: getRandomColor(),
    });
    this.addObject(circle.id, circle.toObject());
  }

  protected notifyObjectChanged(id: string, obj: any) {
    if (this.objects.has(id)) {
      const o1 = this.objects.get(id)!;
      let ok = true;
      for (const k of Object.keys(obj)) {
        if (o1.get(k as any) !== obj[k]) {
          o1.set(k as any, obj[k]);
          console.log(`C ${id}.${k} ${obj[k]}`);
          ok = false;
        }
      }
      if (ok) {
        return;
      }
      if (!this.nogui) {
        o1.setCoords();
      }
    } else {
      if (obj.type === "rect") {
        const rect = new Rect(obj);
        rect.id = id;
        this.canvas.add(rect);
        this.objects.set(id, rect);
      } else if (obj.type === "circle") {
        const circle = new Circle(obj);
        circle.id = id;
        this.canvas.add(circle);
        this.objects.set(id, circle);
      }
    }
    if (!this.nogui) {
      this.canvas.requestRenderAll();
    }
  }

  protected notifyObjectRemoved(id: string) {
    this.canvas.fxRemove(this.objects.get(id)!);
  }
}

(window as any).WebComponents = {
  ready: true,
};
document.dispatchEvent(
  new CustomEvent("WebComponentsReady", { bubbles: true })
);
