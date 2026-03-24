import type { SelectedGame } from '../store/cornerStore';

export const GAME_LABELS: Record<NonNullable<SelectedGame>, string> = {
  bubblepop:       'Bubble Pop',
  tropico:         'Tropico',
  twentyfortyeight: '2048',
  typingtest:      'Typing Test',
  wordle:          'Wordle',
  chess:           'Chess',
};
