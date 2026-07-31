const {
  FuseVersion,
  FuseV1Options,
} = require("@electron/fuses");
const { FusesPlugin } = require("@electron-forge/plugin-fuses");

const windowsCertificateFile = process.env.WINDOWS_CERTIFICATE_FILE;
const windowsCertificatePassword = process.env.WINDOWS_CERTIFICATE_PASSWORD;
const windowsSign =
  windowsCertificateFile && windowsCertificatePassword
    ? {
        certificateFile: windowsCertificateFile,
        certificatePassword: windowsCertificatePassword,
        timestampServer: "http://timestamp.digicert.com",
      }
    : undefined;

module.exports = {
  packagerConfig: {
    appBundleId: "de.devapi.relay",
    asar: true,
    icon: process.platform === "win32" ? "./assets/relay-icon" : undefined,
    executableName: "Relay",
    extraResource: ["../web/dist"],
    name: "Relay",
    protocols: [
      {
        name: "Relay authentication callback",
        schemes: ["devapi"],
      },
    ],
    win32metadata: {
      CompanyName: "DevAPI",
      FileDescription: "Relay collaborative API client",
      InternalName: "Relay",
      OriginalFilename: "Relay.exe",
      ProductName: "Relay",
    },
    windowsSign,
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "relay",
        authors: "DevAPI",
        description: "Kollaborativer REST-API-Client für gemeinsame Team-Workspaces",
        certificateFile: windowsCertificateFile,
        certificatePassword: windowsCertificatePassword,
        setupExe: "Relay-Setup.exe",
        setupIcon: "./assets/relay-icon.ico",
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
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    }),
  ],
};
