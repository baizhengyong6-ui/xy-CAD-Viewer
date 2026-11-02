import { createApp } from 'vue'
import App from './App.vue'
import { i18n } from './i18n'
import { publicUrl } from './runtime/assets'
import './shell/harmony'
import './style.css'

const face = document.createElement('style')
const fontUrl = publicUrl('cad-data/fonts/NotoSansSC-Regular.otf')
face.textContent = `@font-face{font-family:"Lantu Sans";src:url("${fontUrl}") format("opentype");font-display:swap;}`
document.head.appendChild(face)

createApp(App).use(i18n).mount('#app')
