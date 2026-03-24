import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useCornerStore } from '../../../store/cornerStore';

// ── Word bank ─────────────────────────────────────────────────────────────────
const WORD_BANK = [
  'the','be','to','of','and','a','in','that','have','it','for','not','on',
  'with','he','as','you','do','at','this','but','his','by','from','they',
  'we','say','her','she','or','an','will','my','one','all','would','there',
  'their','what','so','up','out','if','about','who','get','which','go','me',
  'when','make','can','like','time','no','just','him','know','take','people',
  'into','year','your','good','some','could','them','see','other','than','then',
  'now','look','only','come','its','over','think','also','back','after','use',
  'two','how','our','work','first','well','way','even','new','want','any',
  'these','give','day','most','us','between','need','large','often','hand',
  'high','place','hold','turn','help','press','problem','point','home','read',
  'move','show','play','small','number','off','always','next','open','seem',
  'together','city','above','never','start','those','leave','light','night',
  'live','word','keep','every','face','book','free','long','real','life','few',
  'right','still','call','find','run','set','last','part','best','feel','once',
  'true','side','near','end','let','form','air','land','water','plant','done',
  'kind','grow','bring','write','same','early','learn','easy','ready','world',
  'while','under','does','walk','found','hard','stand','own','page','should',
  'country','found','answer','school','grow','study','still','learn','plant',
  'cover','food','sun','four','between','state','keep','eye','never','last',
];

function shuffle<T>(a: T[]): T[] {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeWordList(count = 110): string[] {
  const pool = shuffle(WORD_BANK);
  const out: string[] = [];
  while (out.length < count) out.push(...shuffle(pool));
  return out.slice(0, count);
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Mode   = 15 | 30 | 60;
type Status = 'idle' | 'running' | 'finished';

const HS_KEY = 'aero_typing_best';

// ── Sub-components ────────────────────────────────────────────────────────────
function Cursor() {
  return (
    <span
      className="animate-pulse"
      style={{
        display: 'inline-block',
        width: 2,
        height: '1.1em',
        background: '#00d4ff',
        borderRadius: 1,
        verticalAlign: 'text-bottom',
        boxShadow: '0 0 8px rgba(0,212,255,0.9)',
        flexShrink: 0,
      }}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function TypingTest() {
  const { selectGame } = useCornerStore();

  const [mode,       setMode]       = useState<Mode>(30);
  const [status,     setStatus]     = useState<Status>('idle');
  const [wordList,   setWordList]   = useState<string[]>(() => makeWordList());
  const [currentIdx, setCurrentIdx] = useState(0);
  const [input,      setInput]      = useState('');
  const [timeLeft,   setTimeLeft]   = useState<number>(30);
  const [bestWpm,    setBestWpm]    = useState<number>(() => Number(localStorage.getItem(HS_KEY) || 0));
  const [result,     setResult]     = useState({ wpm: 0, rawWpm: 0, accuracy: 0, correct: 0, total: 0 });

  // Refs to avoid stale closures in callbacks / intervals
  const typedRef      = useRef<string[]>([]);
  const currentIdxRef = useRef(0);
  const wordListRef   = useRef(wordList);
  const startRef      = useRef(0);
  const keystrokesRef = useRef(0);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  const gamePaused     = useCornerStore(s => s.gameChatOverlay !== null);
  const pausedTimeLeft = useRef<number | null>(null);
  const timeLeftRef    = useRef(timeLeft);
  timeLeftRef.current  = timeLeft;

  const inputRef     = useRef<HTMLInputElement>(null);
  const activeWordEl = useRef<HTMLSpanElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync refs
  useEffect(() => { wordListRef.current   = wordList;    }, [wordList]);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);

  // ── Scroll active word into view (keep it on 2nd row) ──
  useEffect(() => {
    if (!activeWordEl.current || !containerRef.current) return;
    const el  = activeWordEl.current;
    const box = containerRef.current;
    const ROW = el.offsetHeight + 10; // one row height approx
    if (el.offsetTop > box.scrollTop + ROW * 1.2) {
      box.scrollTop = el.offsetTop - ROW;
    }
  }, [currentIdx]);

  // ── Compute final results ──
  const computeResults = useCallback(() => {
    const elapsed     = (Date.now() - startRef.current) / 60000;
    const words       = wordListRef.current;
    const typed       = typedRef.current;
    const count       = currentIdxRef.current;
    let correctChars  = 0;
    let totalChars    = 0;
    let correctWords  = 0;

    for (let i = 0; i < count; i++) {
      const exp = words[i] ?? '';
      const got = typed[i] ?? '';
      totalChars += got.length + 1; // +1 for the space
      if (got === exp) {
        correctChars += exp.length + 1;
        correctWords++;
      }
    }

    const wpm      = elapsed > 0 ? Math.max(0, Math.round(correctChars / 5 / elapsed)) : 0;
    const rawWpm   = elapsed > 0 ? Math.max(0, Math.round(keystrokesRef.current / 5 / elapsed)) : 0;
    const accuracy = totalChars > 0 ? Math.round((correctChars / totalChars) * 100) : 100;

    setResult({ wpm, rawWpm, accuracy, correct: correctWords, total: count });
    const prev = Number(localStorage.getItem(HS_KEY) || 0);
    if (wpm > prev) {
      setBestWpm(wpm);
      localStorage.setItem(HS_KEY, String(wpm));
    }
    return wpm;
  }, []);

  // ── Finish ──
  const finish = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    computeResults();
    setStatus('finished');
  }, [computeResults]);

  // ── Reset ──
  const reset = useCallback((overrideMode?: Mode) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    const m  = overrideMode ?? mode;
    const wl = makeWordList();
    typedRef.current      = [];
    currentIdxRef.current = 0;
    keystrokesRef.current = 0;
    wordListRef.current   = wl;
    setWordList(wl);
    setCurrentIdx(0);
    setInput('');
    setTimeLeft(m);
    setStatus('idle');
    // Reset scroll
    if (containerRef.current) containerRef.current.scrollTop = 0;
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [mode]);

  // ── Mode change ──
  const changeMode = useCallback((m: Mode) => {
    setMode(m);
    reset(m);
    setTimeLeft(m);
  }, [reset]);

  // ── Timer ──
  useEffect(() => {
    if (status !== 'running') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => (t <= 1 ? 0 : t - 1));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]);

  // Pause / resume countdown when game chat overlay opens / closes
  useEffect(() => {
    if (status !== 'running') return;

    if (gamePaused) {
      // Store remaining time (read from ref to avoid dep on timeLeft) and clear interval
      pausedTimeLeft.current = timeLeftRef.current;
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    } else if (pausedTimeLeft.current !== null) {
      // Resume — restore time and restart interval
      setTimeLeft(pausedTimeLeft.current);
      pausedTimeLeft.current = null;
      timerRef.current = setInterval(() => {
        setTimeLeft(t => (t <= 1 ? 0 : t - 1));
      }, 1000);
    }
  }, [gamePaused, status]);

  // Finish when timer hits 0
  useEffect(() => {
    if (status === 'running' && timeLeft === 0) finish();
  }, [timeLeft, status, finish]);

  // ── Input handler ──
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;

    if (status === 'finished') return;

    // First keystroke starts the timer
    if (status === 'idle' && val.length > 0) {
      startRef.current = Date.now();
      setStatus('running');
    }

    keystrokesRef.current++;

    // Space = submit current word
    if (val.endsWith(' ')) {
      const typed = val.trimEnd();
      typedRef.current[currentIdx] = typed;
      const next = currentIdx + 1;
      currentIdxRef.current = next;
      setCurrentIdx(next);
      setInput('');
      // Extend word list if running low
      if (next >= wordListRef.current.length - 15) {
        const extra = makeWordList(50);
        const newList = [...wordListRef.current, ...extra];
        wordListRef.current = newList;
        setWordList(newList);
      }
      return;
    }

    setInput(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Backspace on empty input → go back to previous word (only if it was wrong)
    if (e.key === 'Backspace' && input === '' && currentIdx > 0) {
      const prev     = currentIdx - 1;
      const prevWord = wordListRef.current[prev] ?? '';
      const prevTyped = typedRef.current[prev] ?? '';
      if (prevTyped !== prevWord) {
        currentIdxRef.current = prev;
        setCurrentIdx(prev);
        setInput(prevTyped);
      }
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  function renderWord(wi: number) {
    const word       = wordList[wi] ?? '';
    const isActive   = wi === currentIdx;
    const isComplete = wi < currentIdx;
    const typedStr   = isActive ? input : (typedRef.current[wi] ?? '');
    const isWrong    = isComplete && typedStr !== word;

    // Characters to render: word chars + overflow
    const chars      = word.split('');
    const overflow   = isActive && input.length > word.length ? input.slice(word.length) : '';

    return (
      <span
        key={wi}
        ref={isActive ? (el) => { activeWordEl.current = el; } : undefined}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '1px 3px',
          borderRadius: 5,
          background: isActive ? 'rgba(0,212,255,0.07)' : 'transparent',
          outline: isActive ? '1px solid rgba(0,212,255,0.18)' : 'none',
          textDecoration: isWrong ? 'underline wavy #ff5c5c' : 'none',
          marginRight: 8,
          marginBottom: 8,
          position: 'relative',
        }}
      >
        {chars.map((char, ci) => {
          const showCursorBefore = isActive && ci === Math.min(input.length, word.length);
          let state: 'pending' | 'correct' | 'wrong' = 'pending';
          if (isActive) {
            if (ci < input.length) state = input[ci] === char ? 'correct' : 'wrong';
          } else if (isComplete) {
            if (ci < typedStr.length) state = typedStr[ci] === char ? 'correct' : 'wrong';
            else state = 'pending';
          }
          // Dim completed correct words slightly
          const color: string = (() => {
            if (isActive) {
              return state === 'correct' ? '#00d4ff' : state === 'wrong' ? '#ff5c5c' : 'rgba(255,255,255,0.22)';
            }
            if (isComplete) {
              return state === 'correct' ? 'rgba(255,255,255,0.55)'
                   : state === 'wrong'   ? '#ff5c5c'
                   : 'rgba(255,255,255,0.15)';
            }
            return 'rgba(255,255,255,0.18)'; // future
          })();

          return (
            <span key={ci} style={{ display: 'inline-flex', alignItems: 'center' }}>
              {showCursorBefore && <Cursor />}
              <span style={{ color, fontFamily: '"JetBrains Mono","Fira Code","Cascadia Code",ui-monospace,monospace', fontSize: 16 }}>
                {char}
              </span>
            </span>
          );
        })}

        {/* Overflow chars typed beyond word length */}
        {overflow && (
          <span style={{ color: '#ff5c5c', fontFamily: '"JetBrains Mono","Fira Code","Cascadia Code",ui-monospace,monospace', fontSize: 16 }}>
            {overflow}
          </span>
        )}

        {/* Cursor at end when input.length >= word.length */}
        {isActive && input.length >= word.length && <Cursor />}
      </span>
    );
  }

  const timerWarning = timeLeft <= 5  ? '#ff5c5c'
    : timeLeft <= 10 ? '#FF9B00'
    : '#00d4ff';

  const isNewBest = result.wpm > 0 && result.wpm >= bestWpm;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex h-full flex-col select-none"
      onClick={() => inputRef.current?.focus()}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-5 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--panel-divider)' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); selectGame(null); }}
            className="flex h-8 w-8 items-center justify-center rounded-xl transition-all flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.25)', fontSize: 18 }}
          >
            ⌨️
          </div>

          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Type Rush</p>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>How fast can you type?</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode tabs */}
          <div
            className="flex rounded-xl p-1"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
          >
            {([15, 30, 60] as Mode[]).map(m => (
              <button
                key={m}
                onClick={e => { e.stopPropagation(); changeMode(m); }}
                className="rounded-lg px-3 py-1 text-[11px] font-bold transition-all"
                style={{
                  background: mode === m ? 'rgba(0,212,255,0.18)' : 'transparent',
                  color:      mode === m ? '#00d4ff' : 'var(--text-muted)',
                  border:     mode === m ? '1px solid rgba(0,212,255,0.30)' : '1px solid transparent',
                }}
              >
                {m}s
              </button>
            ))}
          </div>

          {/* Reset */}
          <button
            onClick={e => { e.stopPropagation(); reset(); }}
            className="flex h-8 w-8 items-center justify-center rounded-xl transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Main ── */}
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-4 min-h-0">

        {status !== 'finished' ? (
          <>
            {/* Timer */}
            <div
              className="tabular-nums font-black transition-colors"
              style={{
                fontSize: 52,
                lineHeight: 1,
                color: timerWarning,
                letterSpacing: '-0.04em',
                textShadow: `0 0 32px ${timerWarning}55`,
              }}
            >
              {status === 'idle' ? mode : timeLeft}
            </div>

            {/* Words area */}
            <div
              ref={containerRef}
              className="w-full rounded-2xl p-4"
              style={{
                height: 128,
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.07)',
                cursor: 'text',
              }}
            >
              <div className="flex flex-wrap" style={{ lineHeight: 1.6, alignContent: 'flex-start' }}>
                {wordList.map((_, wi) => renderWord(wi))}
              </div>
            </div>

            {/* Hidden input that captures typing */}
            <input
              ref={inputRef}
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              className="sr-only"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              tabIndex={0}
            />

            {/* Hint / best */}
            <div className="flex items-center justify-between w-full" style={{ maxWidth: 480 }}>
              {status === 'idle' ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.55 }}>
                  Click here and start typing
                </p>
              ) : (
                <div />
              )}
              {bestWpm > 0 && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Best:&nbsp;<span style={{ color: '#00d4ff', fontWeight: 700 }}>{bestWpm} WPM</span>
                </p>
              )}
            </div>
          </>
        ) : (
          /* ── Results ── */
          <div className="flex flex-col items-center gap-5 w-full max-w-xs">
            {/* WPM hero */}
            <div className="text-center">
              <p
                className="font-black tabular-nums"
                style={{
                  fontSize: 64,
                  lineHeight: 1,
                  color: '#00d4ff',
                  letterSpacing: '-0.04em',
                  textShadow: '0 0 48px rgba(0,212,255,0.55)',
                }}
              >
                {result.wpm}
              </p>
              <p className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: 'var(--text-muted)' }}>
                WPM
              </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2.5 w-full">
              {[
                {
                  label: 'Accuracy',
                  value: `${result.accuracy}%`,
                  color: result.accuracy >= 95 ? '#4fc97a' : result.accuracy >= 85 ? '#FF9B00' : '#ff5c5c',
                },
                {
                  label: 'Raw WPM',
                  value: String(result.rawWpm),
                  color: 'var(--text-secondary)',
                },
                {
                  label: 'Words',
                  value: `${result.correct}/${result.total}`,
                  color: 'var(--text-secondary)',
                },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-1 rounded-2xl p-3"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <span className="text-lg font-bold" style={{ color }}>{value}</span>
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* New best badge */}
            {isNewBest && (
              <div
                className="flex items-center gap-2 rounded-full px-4 py-2"
                style={{ background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.28)' }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: '#00d4ff' }}>
                  🏆 New personal best!
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={e => { e.stopPropagation(); reset(); }}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all"
                style={{ background: 'rgba(0,212,255,0.14)', border: '1px solid rgba(0,212,255,0.30)', color: '#00d4ff' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,212,255,0.24)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,212,255,0.14)')}
              >
                <RotateCcw className="h-4 w-4" />
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
