# Conversion to obsidian-settings-ui

- The library on which the conversion is based was developed by [Dariusz Kanicki](https://github.com/dariuszkanicki).  
- This also applies to the conversion of the settings panel.  
- Developer documentation for the library is available on GitHub: [obsidian-settings-ui](https://github.com/dariuszkanicki/obsidian-settings-ui)

```table-of-contents
```

## Dependencies installation

I followed the installation description:

```
pnpm add @dkani/obsidian-settings-ui
pnpm add colord
pnpm add --save-dev tsx postcss postcss-prefix-selector
```

I added to `package.json`:
```
"scripts": {
  "inject:styles": "node node_modules/@dkani/obsidian-settings-ui/dist/scripts/inject-prefixed-styles.js",      
},
```

then run:
`pnpm inject:styles`

## Creating Setting Panel

To make the conversion process easier to understand and to minimize changes to the original code, I placed most of the modifications in a separate folder, `src/dkani`. This should help clarify the changes and keep them separate from the original code. It also makes it easier to see the differences in implementation between the "before" and "after" states. Once the pull request is accepted, it would make sense, in my opinion, to move all the necessary code to its original location and delete the `dkani` folder.

### Changes

I replaced the two toggles with a radio group, which I believe is more intuitive for the user. As soon as the auto-save function is activated (i.e., the interval is set to a value greater than 0), the radio group becomes visible with the default option preselected. This clearly signals to the user that autosave is currently using the general interval setting.

The user can then choose one of the two alternative options if they wish. I personally found the original solution with the two toggles somewhat confusing at first, and I believe this new approach is both more intuitive and informative.

In `src/types.ts`, I introduced the new `saveIntervalType` field:

```ts
+    saveIntervalType:
+        | "autoSaveIntervalInGeneral"
+        | "autoBackupAfterFileChange"
+        | "setLastSaveToLastCommit";

-    showErrorNotices: boolean;
+    disableErrorNotice: boolean;

+    /**
+     * @deprecated Use `saveIntervalType` instead.
+     */
     autoBackupAfterFileChange: boolean;
+    /**
+     * @deprecated Use `saveIntervalType` instead.
+     */
     setLastSaveToLastCommit: boolean;
```

The replaced properties have been marked as deprecated and can be removed in a future cleanup step.

Additionally, I renamed the `showErrorNotices` property to `disableErrorNotice` to maintain naming consistency with related properties.

In `src/constants.ts`
```ts
+    saveIntervalType: "autoSaveIntervalInGeneral",

-    showErrorNotices: true,
+    disableErrorNotice: false,
```

in `src/main.ts`
```ts
+import { ObsidianNewGitSettingsTab } from "./dkani/setting/setting-tab";
 
-    settingsTab?: ObsidianGitSettingsTab;
+    settingsTab?: ObsidianNewGitSettingsTab;

-        this.settingsTab = new ObsidianGitSettingsTab(this.app, this);
+        this.settingsTab = new ObsidianNewGitSettingsTab(this);

-        if (this.settings.showErrorNotices) {
+        if (!this.settings.disableErrorNotice) {
```

in `src/setting/settings.ts`
```ts
-                    .setValue(!plugin.settings.showErrorNotices)
+                    .setValue(!plugin.settings.disableErrorNotice)
                     .onChange(async (value) => {
-                        plugin.settings.showErrorNotices = !value;
+                        plugin.settings.disableErrorNotice = value;
```

These changes are not really relevant as the `settings.ts` will not be involved anymore, it's just for consistency and compiler requirements.

### Localization

While working on the conversion, I took the opportunity to demonstrate the localization functionality by providing translations in three languages: English, German, and Polish. When the settings panel is opened, there’s a ⚙️ icon — clicking it opens a small popup that allows the user to switch the language. Additionally, there's an option to adjust the label width so that all labels fit on a single line.


