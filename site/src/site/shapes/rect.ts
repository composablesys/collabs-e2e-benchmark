import { fabric } from "fabric";

export class Rect extends fabric.Rect {
  public id: string;

  constructor(options: fabric.IRectOptions & { id: string }) {
    const { id, ...rectOptions } = options;
    rectOptions.includeDefaultValues = false;
    super(rectOptions);
    this.id = id;
  }
}
