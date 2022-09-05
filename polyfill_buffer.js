import { Platform } from 'obsidian';
let buffer;
if (Platform.isMobileApp) {
    buffer = require('buffer/index.js').Buffer
} else {
    buffer = global.Buffer
}

export const Buffer = buffer;
