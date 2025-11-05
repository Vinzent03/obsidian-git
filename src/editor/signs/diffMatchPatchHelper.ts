// /* eslint-disable @typescript-eslint/no-unsafe-argument */
// /* eslint-disable @typescript-eslint/no-unsafe-call */
// /* eslint-disable @typescript-eslint/no-unsafe-member-access */
// /* eslint-disable @typescript-eslint/no-unused-expressions */
// /* eslint-disable @typescript-eslint/no-explicit-any */
// import * as dmp from "@sanity/diff-match-patch";
//
// export function charsToLines(diffs: dmp.Diff[], lineArray: string[]) {
//     for (let x = 0; x < diffs.length; x++) {
//         const chars = diffs[x][1],
//             text = [];
//         for (let y = 0; y < chars.length; y++)
//             text[y] = lineArray[chars.charCodeAt(y)];
//         diffs[x][1] = text.join("");
//     }
// }
// export function linesToChars(textA: string, textB: string) {
//     const lineArray = [],
//         lineHash: any = {};
//     lineArray[0] = "";
//     function diffLinesToMunge(text: string) {
//         let chars = "",
//             lineStart = 0,
//             lineEnd = -1,
//             lineArrayLength = lineArray.length;
//         for (; lineEnd < text.length - 1; ) {
//             (lineEnd = text.indexOf(
//                 `
// `,
//                 lineStart
//             )),
//                 lineEnd === -1 && (lineEnd = text.length - 1);
//             let line = text.slice(lineStart, lineEnd + 1);
//             (
//                 lineHash.hasOwnProperty
//                     ? // eslint-disable-next-line no-prototype-builtins
//                       lineHash.hasOwnProperty(line)
//                     : lineHash[line] !== void 0
//             )
//                 ? (chars += String.fromCharCode(lineHash[line]))
//                 : (lineArrayLength === maxLines &&
//                       ((line = text.slice(lineStart)), (lineEnd = text.length)),
//                   (chars += String.fromCharCode(lineArrayLength)),
//                   (lineHash[line] = lineArrayLength),
//                   (lineArray[lineArrayLength++] = line)),
//                 (lineStart = lineEnd + 1);
//         }
//         return chars;
//     }
//     let maxLines = 4e4;
//     const chars1 = diffLinesToMunge(textA);
//     maxLines = 65535;
//     const chars2 = diffLinesToMunge(textB);
//     return { chars1, chars2, lineArray };
// }
