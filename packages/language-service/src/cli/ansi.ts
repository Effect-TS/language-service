// ANSI escape codes
export const RESET = "\x1b[0m"
export const BOLD = "\x1b[0;1m"
export const DIM = "\x1b[0;90m" // blackBright
export const RED = "\x1b[0;31m"
export const GREEN = "\x1b[0;32m"
export const YELLOW = "\x1b[0;33m"
export const BLUE = "\x1b[0;34m"
export const CYAN = "\x1b[0;36m"
export const WHITE = "\x1b[0;37m"
export const CYAN_BRIGHT = "\x1b[0;96m"
export const BG_BLACK_BRIGHT = "\x1b[0;100m"
export const BG_RED = "\x1b[41m"
export const BG_YELLOW = "\x1b[43m"
export const BG_BLUE = "\x1b[0;44m"
export const BG_CYAN = "\x1b[0;46m"

export const ansi = (text: string, code: string): string => `${code}${text}${RESET}`

// Terminal control sequences
export const ERASE_LINE = "\x1b[2K"
export const CURSOR_LEFT = "\r"
export const CURSOR_HIDE = "\x1b[?25l"
export const CURSOR_SHOW = "\x1b[?25h"
export const CURSOR_TO_0 = "\x1b[G"
export const BEEP = "\x07"

export const ITALIC = "\x1b[0;3m"
export const UNDERLINE = "\x1b[0;4m"

export const ANSI_ESCAPE_REGEX = new RegExp(String.raw`\u001b\[[0-?]*[ -/]*[@-~]`, "g")
export const stripAnsi = (text: string): string => text.replace(ANSI_ESCAPE_REGEX, "")
export const visibleLength = (text: string): number => stripAnsi(text).length

export const CLEAR_SCREEN = "\x1b[2J"
export const CLEAR_SCROLLBACK = "\x1b[3J"
export const CURSOR_HOME = "\x1b[H"
