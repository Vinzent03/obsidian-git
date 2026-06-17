import { Platform } from 'obsidian';
let buffer;
if (Platform.isMobileApp) {
    buffer = require('buffer/index.js').Buffer
} else {
    buffer = require('buffer/index.js').Buffer
}

export const Buffer = buffer;
