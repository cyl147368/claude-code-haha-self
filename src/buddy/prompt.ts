import { feature } from 'bun:bundle'
import type { Message } from '../types/message.js'
import type { Attachment } from '../utils/attachments.js'
import { getGlobalConfig } from '../utils/config.js'
import { getCompanion } from './companion.js'

export function companionIntroText(name: string, species: string): string {
  return `# 伙伴

一个名叫 ${name} 的小 ${species} 会待在用户输入框旁边，偶尔用气泡评论。你不是 ${name}；它是独立的观察者。

当用户直接按名字称呼 ${name} 时，它的气泡会回答。那时你的职责是让开：最多回复一行，或只回答消息中确实面向你的部分。不要解释你不是 ${name}，用户知道。也不要转述 ${name} 可能会说什么，气泡会处理。`
}

export function getCompanionIntroAttachment(
  messages: Message[] | undefined,
): Attachment[] {
  if (!feature('BUDDY')) return []
  const companion = getCompanion()
  if (!companion || getGlobalConfig().companionMuted) return []

  // Skip if already announced for this companion.
  for (const msg of messages ?? []) {
    if (msg.type !== 'attachment') continue
    if (msg.attachment.type !== 'companion_intro') continue
    if (msg.attachment.name === companion.name) return []
  }

  return [
    {
      type: 'companion_intro',
      name: companion.name,
      species: companion.species,
    },
  ]
}
