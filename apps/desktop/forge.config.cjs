const {
  FuseVersion,
  FuseV1Options,
} = require("@electron/fuses");
const { FusesPlugin } = require("@electron-forge/plugin-fuses");

module.exports = {
  packagerConfig: {
    asar: true,
    executableName: "Relay",
    extraResource: ["../web/dist"],
    name: "Relay",
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "relay",
        setupExe: "Relay-Setup.exe",
      },
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["win32"],
    },
  ],
  plugins: [
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
