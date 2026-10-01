const { readFileSync } = require("node:fs");

module.exports = {
    readVersion() {
        return JSON.parse(readFileSync("manifest.json", "utf8")).version;
    },
    writeVersion(contents, version) {
        const versions = JSON.parse(contents);
        const { minAppVersion } = JSON.parse(
            readFileSync("manifest.json", "utf8")
        );
        const latestMinAppVersion = Object.values(versions).at(-1);

        if (minAppVersion !== latestMinAppVersion) {
            versions[version] = minAppVersion;
            return JSON.stringify(versions, null, 4) + "\n";
        }

        return contents;
    },
};
