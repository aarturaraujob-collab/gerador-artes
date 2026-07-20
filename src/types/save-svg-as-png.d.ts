declare module "save-svg-as-png" {
  export function svgAsPngUri(
    svg: SVGElement,
    options?: {
      scale?: number;
      encoderOptions?: number;
      backgroundColor?: string;
      left?: number;
      top?: number;
      width?: number;
      height?: number;
    }
  ): Promise<string>;
}