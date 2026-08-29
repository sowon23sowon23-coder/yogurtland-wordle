import 'server-only';
import words from './wordlist/allowed-guesses.json';

// Public-domain (Unlicense) Wordle valid-guess list — ~14.8k common 5-letter
// English words, uppercased. Source: github.com/tabatkins/wordle-list.
// Today's actual answers live in the `words` table in Supabase, not here;
// this file only decides which *guesses* the player is allowed to submit.
const ALLOWED_GUESSES: ReadonlySet<string> = new Set(words as string[]);

export function isAllowedGuess(word: string): boolean {
  return ALLOWED_GUESSES.has(word);
}
