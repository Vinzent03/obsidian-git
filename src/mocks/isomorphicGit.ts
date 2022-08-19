//@ts-nocheck
// This file replaces the real src/isomorphicGit.ts file in the release build for obsidian-git plugin to reduce package size.
import { GitManager } from "src/gitManager";
export class IsomorphicGit extends GitManager {

}