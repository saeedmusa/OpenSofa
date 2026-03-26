import type { Terminal as XTerm } from '@xterm/xterm';

interface InputBarProps {
  sessionId: string;
  getTerminal: () => XTerm | null;
}

export function InputBar(_props: InputBarProps) {
  return null;
}
