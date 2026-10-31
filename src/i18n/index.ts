import { createI18n } from 'vue-i18n'
import en from './en'
import zhCN from './zh-CN'

export const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    en,
  },
})

export type MessageSchema = typeof zhCN
