import { fabric } from "fabric";

export class Circle extends fabric.Circle {
  public id: string;

  constructor(options: fabric.ICircleOptions & { id: string }) {
    const { id, ...circleOptions } = options;
    circleOptions.includeDefaultValues = false;
    super(circleOptions);
    this.id = id;
  }
}
