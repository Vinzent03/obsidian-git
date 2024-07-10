import type ObsidianGit from "src/main";

/**
 * Store the reference to the {@link ObsidianGit} plugin globally, so that
 * the line author gutter context menu can access it for quick configuration.
 */
export const pluginRef: { plugin?: ObsidianGit } = {};
