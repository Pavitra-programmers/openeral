declare namespace NodeJS {
  interface Process {
    /** Electron resource directory; absent under plain Node. */
    resourcesPath?: string;
  }
}
