import { AbilityConstant, UIAbility, Want } from '@kit.AbilityKit'
import { webview } from '@kit.ArkWeb'
import { window } from '@kit.ArkUI'
import { CadInbox } from '../common/CadInbox'

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, _launchParam: AbilityConstant.LaunchParam): void {
    webview.WebviewController.initializeWebEngine()
    CadInbox.importWant(want)
  }

  onNewWant(want: Want, _launchParam: AbilityConstant.LaunchParam): void {
    CadInbox.importWant(want)
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    windowStage.loadContent('pages/Index')
  }
}
