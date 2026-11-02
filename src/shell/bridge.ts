export interface WorldPoint {
  x: number
  y: number
}

export interface LantuBridge {
  /** Shells (Tauri, Capacitor, ArkWeb) push a local file without a browser picker. */
  openCadFile(name: string, data: ArrayBuffer): Promise<boolean>
  worldToClient(x: number, y: number): WorldPoint | null
}

export interface HarmonyHost {
  pick(): void
  share(name: string, mime: string, dataBase64: string): void
}

declare global {
  interface Window {
    openCadFile: LantuBridge['openCadFile']
    lantu: LantuBridge
    XinyaoHarmony?: HarmonyHost
    __xinyaoOpenInbox?: (id: string, name: string) => void
  }
}

export function installBridge(bridge: LantuBridge): void {
  window.openCadFile = (name, data) => bridge.openCadFile(name, data)
  window.lantu = bridge
}
