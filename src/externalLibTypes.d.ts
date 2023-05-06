declare module "css-color-converter" {
    /* The following list of type definitions is incomplete! */

    class Color {
        toRgbaArray(): [number, number, number, number];
        toRgbString(): string;
        toRgbaString(): string;
        toHslString(): string;
        toHslaString(): string;
        toHexString(): string;
    }
    function fromString(str: string): Color | null;
}
