'use client';

import { motion } from 'framer-motion';
import type { Message } from '@/lib/technocore/types';
import { formatRelativeTime } from '@/lib/utils/format';
import { hashToColor } from '@/lib/utils/color';
import { cn } from '@/lib/utils/cn';

export type MessageItemProps = {
  message: Message;
  isNew?: boolean;
};

export function MessageItem({ message, isNew = false }: MessageItemProps) {
  const signed = message.isSigned;
  const senderLabel = message.from.startsWith('~')
    ? message.from.slice(1)
    : message.from;
  const avatarColor = hashToColor(message.from);
  const avatarText = senderLabel.slice(0, 4) || '??';

  return (
    <motion.div
      initial={
        isNew ? { backgroundColor: 'rgba(0, 212, 255, 0.12)' } : false
      }
      animate={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
      transition={{ duration: 1, ease: 'easeOut' }}
      className={cn(
        'flex gap-3 px-4 py-3 border-b border-bg-light/40',
        isNew && 'bg-accent-cyan/10',
      )}
      role="listitem"
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-[10px] leading-none text-white"
        style={{ backgroundColor: avatarColor }}
        aria-hidden="true"
        title={message.from}
      >
        {avatarText}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span
            className={cn(
              'truncate font-mono text-xs font-medium',
              signed ? 'text-accent-cyan' : 'text-white',
            )}
            title={message.from}
          >
            {senderLabel}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-gray-500">
            {formatRelativeTime(message.ts)}
          </span>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text-primary">
          {message.text}
        </p>
      </div>
    </motion.div>
  );
}

export default MessageItem;
