import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, RotateCcw, Lightbulb } from 'lucide-react';
import { useCornerStore } from '../../../store/cornerStore';

// ── Word banks by length ───────────────────────────────────────────────────────
const W4 = [
  'acre','arch','area','army','base','bath','bear','beat','bell','bend','bike','bill',
  'bird','bite','blow','blue','boat','bold','bolt','bond','bone','book','born','boss',
  'bowl','burn','cage','cake','call','calm','card','care','cart','case','cash','cast',
  'cave','chip','clay','clip','club','coal','coat','code','coil','cold','come','cool',
  'cope','core','corn','cost','crew','crop','cure','dark','data','date','dawn','dead',
  'deal','deep','desk','dice','diet','dish','dive','dock','dome','done','door','dose',
  'down','draw','drop','drum','dune','dusk','dust','duty','each','earn','edge','exit',
  'face','fact','fade','fair','fall','fame','farm','fast','fate','fear','feet','fill',
  'film','find','fire','fish','flag','flat','flip','flow','foam','fold','folk','food',
  'fool','foot','fork','form','free','frog','fuel','full','fund','game','gate','gear',
  'gift','glow','glue','goal','gold','gone','gown','grab','grid','grip','grow','gulf',
  'hail','half','hall','hand','hard','harm','hawk','head','heal','heat','heel','hide',
  'hill','hole','hood','hook','hope','horn','host','hunt','iron','jail','keen','keep',
  'kick','kill','kind','king','kiss','knot','lack','lake','land','lane','last','late',
  'lawn','lead','leaf','lean','left','lend','lion','list','lock','long','look','lord',
  'lose','loss','loud','love','lure','mail','main','many','mark','mask','mass','mind',
  'mine','mist','mode','mole','much','must','myth','nail','name','neck','need','news',
  'nine','none','norm','note','once','open','pace','pack','page','paid','path','peak',
  'pick','pile','pine','pipe','pity','plan','play','plot','plug','poll','pond','pool',
  'poor','port','pose','post','pray','prey','pull','pure','push','rage','raid','rail',
  'rain','rare','rate','real','reel','rely','rent','rest','rice','rich','ride','ring',
  'riot','rise','risk','road','roar','robe','role','roll','room','root','rope','rose',
  'ruin','rule','rush','rust','safe','sail','sale','salt','save','seal','seed','seek',
  'sell','shed','ship','shoe','shop','silk','sing','sink','skip','slam','slim','slip',
  'slow','snap','soil','song','soul','spin','spot','spur','step','stem','stop','suit',
  'swap','tale','tall','tank','task','tear','tend','term','test','text','tide','toll',
  'tone','took','torn','toss','town','trap','tree','trim','trip','true','tube','tune',
  'type','veil','vein','vine','void','wake','walk','wall','ward','warm','wave','weld',
  'went','west','wide','wild','wind','wine','wing','wire','wise','wish','wolf','worm',
  'wrap','yard','zero','zone',
];

const W5 = [
  'about','actor','acute','admit','adult','after','again','agent','agree','ahead',
  'alarm','alert','alike','align','alive','alley','allow','alone','along','alter',
  'angel','anger','angle','ankle','apart','apple','apply','arena','argue','arise',
  'armor','aroma','array','arrow','aside','asset','avoid','awake','award','aware',
  'badly','basic','beach','beard','beast','begin','being','below','bench','black',
  'blade','blame','blank','blast','blaze','bleed','blend','bless','blind','block',
  'blood','bloom','board','boost','bound','brain','brand','brave','bread','break',
  'breed','brick','bride','brief','bring','broad','brown','brush','build','built',
  'burst','buyer','cabin','candy','carry','cause','chain','chair','chaos','charm',
  'chart','chase','cheap','check','cheek','cheer','chess','chest','chief','child',
  'civic','civil','claim','class','clean','clear','click','cliff','climb','clock',
  'close','cloud','coach','coast','coral','count','court','cover','crack','craft',
  'crane','crash','crazy','cream','crime','cross','crowd','crown','crush','curve',
  'cycle','dance','death','decay','delay','depth','devil','doubt','dough','draft',
  'drain','drama','drawn','dream','dress','drift','drink','drive','drums','eagle',
  'early','earth','eight','elite','empty','enemy','enter','entry','equal','error',
  'essay','event','every','exact','extra','fable','faith','false','fancy','fatal',
  'fault','feast','field','final','first','flame','flash','flesh','float','flood',
  'floor','focus','force','forge','forth','forum','found','frame','frank','fraud',
  'front','frost','fruit','funny','ghost','giant','given','glass','gleam','globe',
  'gloss','glove','grace','grade','grain','grand','grant','graph','grasp','grass',
  'great','green','grief','grill','grind','groan','group','grove','grown','guard',
  'guest','guide','happy','harsh','heart','heavy','herbs','hobby','honey','honor',
  'house','human','hurry','image','index','inner','input','irony','issue','ivory',
  'joint','judge','juice','juicy','karma','knife','knock','known','label','large',
  'laser','later','laugh','layer','learn','least','legal','level','light','limit',
  'liver','local','logic','loose','lover','lower','lucky','lunar','lyric','magic',
  'major','maker','march','match','mayor','media','merit','mercy','metal','might',
  'minor','mixed','model','money','month','moral','mount','mouse','mouth','movie',
  'music','naval','never','night','noble','noise','north','novel','nurse','ocean',
  'offer','often','opera','orbit','order','outer','ozone','paint','panel','panic',
  'paper','patch','pause','peace','pearl','penny','phase','phone','photo','piano',
  'pilot','pixel','place','plain','plane','plant','plate','plaza','point','polar',
  'pound','power','press','price','pride','prime','print','prior','prize','probe',
  'proof','prose','proud','prove','pulse','punch','quick','quiet','quote','radio',
  'raise','range','rapid','ratio','reach','ready','realm','rebel','relax','relay',
  'reply','ridge','right','risky','rival','river','robot','rocky','rough','round',
  'route','royal','saint','sauce','scale','scene','score','scout','serve','seven',
  'shaft','shape','share','shark','sharp','shelf','shell','shift','shiny','shook',
  'shoot','short','shout','sight','since','sixth','skill','skull','slate','sleek',
  'sleep','slept','slide','slope','small','smart','smile','smoke','solar','solid',
  'solve','sorry','south','space','spare','spark','spawn','speak','speed','spell',
  'spend','spent','spice','spike','spine','spoke','spoon','spray','squad','stack',
  'staff','stage','stand','stare','start','state','steam','steel','stern','stone',
  'stood','store','storm','story','strap','strip','study','style','sugar','super',
  'surge','swear','swing','sword','table','taste','teach','thing','think','third',
  'thorn','three','throw','tight','timer','tired','title','today','topic','total',
  'touch','tower','toxic','trace','track','trade','trail','train','trait','trash',
  'trial','trick','tried','tribe','truth','twice','twist','ultra','under','union',
  'until','upper','upset','urban','valid','value','vault','verse','video','viral',
  'virus','visit','vista','vital','voice','wagon','watch','water','weary','weird',
  'whole','width','witch','world','worry','worse','worst','worth','would','wound',
  'wrath','write','wrote','young','youth','zebra',
];

const W6 = [
  'absent','accept','access','action','active','actual','advice','affect','afraid',
  'agenda','almost','amount','animal','answer','appear','arrive','asleep','assign',
  'attach','attack','attend','battle','beauty','become','before','behind','better',
  'bottom','branch','breath','bridge','bright','broken','budget','button','camera',
  'cancel','change','charge','choice','choose','circle','client','closed','commit',
  'common','corner','credit','crisis','danger','decide','design','detail','dinner',
  'direct','divide','domain','double','driven','effect','emerge','empire','enough',
  'entire','escape','exceed','except','expand','extend','figure','finger','follow',
  'forest','format','future','garden','gather','gender','global','ground','growth',
  'happen','harbor','health','hidden','honest','hunter','impact','income','indeed',
  'injury','inside','invite','island','jungle','junior','ladder','launch','leader',
  'league','length','lesson','letter','likely','listen','living','lonely','longer',
  'manage','manner','market','master','matter','member','method','middle','minute',
  'mirror','modern','module','moment','mother','motion','murder','muscle','narrow',
  'nature','nearly','needle','normal','notice','object','obtain','office','online',
  'output','parent','people','phrase','planet','player','pocket','pretty','prison',
  'profit','proper','public','pursue','puzzle','rather','really','reason','recent',
  'remove','repair','repeat','rescue','result','return','review','reward','rising',
  'rocket','safety','sample','secret','select','series','shadow','signal','simple',
  'single','sister','slowly','source','spread','spring','square','stable','status',
  'stream','street','strong','studio','submit','sudden','sunset','talent','target',
  'theory','though','throat','ticket','timber','tissue','toggle','toward','tragic',
  'travel','update','useful','valley','varied','violet','vision','volume','wallet',
  'wanted','wealth','window','winter','wizard','wonder','wooden','worker','yellow',
];

const W7 = [
  'ability','absence','achieve','anxious','attempt','captain','century','climate',
  'command','compete','concern','connect','content','control','culture','curious',
  'develop','digital','discuss','display','distant','dolphin','economy','element',
  'embrace','emperor','explode','explore','failure','freedom','gallery','genuine',
  'harmony','history','horizon','journey','justice','kingdom','landing','library',
  'machine','measure','message','million','missing','monster','morning','mystery',
  'network','nothing','nucleus','popular','problem','produce','protect','provide',
  'quality','quickly','reality','receive','release','replace','require','restore',
  'science','silence','surface','symptom','teacher','thought','tightly','trouble',
  'weather','welcome','western','without',
];

const WORDS_BY_LEN: Record<number, string[]> = { 4: W4, 5: W5, 6: W6, 7: W7 };
// Weight towards common lengths
const LENGTH_POOL = [4, 5, 5, 5, 6, 6, 7];

const KEYBOARD_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','⌫'],
];

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_GUESSES = 6;
const HINT_COST   = 100;
const SCORE_TABLE = [1000, 850, 700, 550, 400, 250];
const HS_KEY      = 'aero_wordle_best';

// ── Types ─────────────────────────────────────────────────────────────────────
type LetterState = 'correct' | 'present' | 'absent' | 'tbd' | 'empty';
type GameStatus  = 'playing' | 'won' | 'lost';

// ── Helpers ───────────────────────────────────────────────────────────────────
function pickGame(): { answer: string; startHint: (string | null)[] } {
  const len    = LENGTH_POOL[Math.floor(Math.random() * LENGTH_POOL.length)];
  const pool   = WORDS_BY_LEN[len];
  const answer = pool[Math.floor(Math.random() * pool.length)];
  // Reveal one random letter for free at game start
  const pos       = Math.floor(Math.random() * len);
  const startHint = Array(len).fill(null) as (string | null)[];
  startHint[pos]  = answer[pos].toUpperCase();
  return { answer, startHint };
}

function evaluate(guess: string, answer: string): LetterState[] {
  const result: LetterState[] = Array(answer.length).fill('absent');
  const pool = answer.split('') as (string | null)[];
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === pool[i]) { result[i] = 'correct'; pool[i] = null; }
  }
  for (let i = 0; i < answer.length; i++) {
    if (result[i] === 'correct') continue;
    const j = pool.indexOf(guess[i]);
    if (j !== -1) { result[i] = 'present'; pool[j] = null; }
  }
  return result;
}

function tileSizeFor(len: number) {
  return len <= 4 ? 54 : len === 5 ? 48 : len === 6 ? 43 : 37;
}

// ── Tile ──────────────────────────────────────────────────────────────────────
function Tile({
  letter, state, size, isRevealing, animDelay,
}: {
  letter: string;
  state: LetterState;
  size: number;
  isRevealing: boolean;
  animDelay: number;
}) {
  const style: Record<LetterState, React.CSSProperties> = {
    correct: { background:'rgba(0,212,255,0.20)',  border:'2px solid rgba(0,212,255,0.75)', color:'#00d4ff',            boxShadow:'0 0 14px rgba(0,212,255,0.40)' },
    present: { background:'rgba(245,158,11,0.18)', border:'2px solid rgba(245,158,11,0.70)',color:'#f59e0b',            boxShadow:'0 0 14px rgba(245,158,11,0.35)' },
    absent:  { background:'rgba(255,255,255,0.07)',border:'2px solid rgba(255,255,255,0.13)',color:'rgba(255,255,255,0.30)' },
    tbd:     { background:'rgba(255,255,255,0.08)',border:'2px solid rgba(255,255,255,0.45)',color:'var(--text-primary)' },
    empty:   { background:'rgba(255,255,255,0.03)',border:'2px solid rgba(255,255,255,0.09)',color:'transparent' },
  };

  return (
    <div
      style={{
        width: size, height: size,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 8,
        fontSize: size * 0.38,
        fontWeight: 800,
        letterSpacing: 1,
        userSelect: 'none',
        animation: isRevealing
          ? `wrd-flip 0.55s ease ${animDelay}s both`
          : letter && state === 'tbd'
          ? 'wrd-pop 0.12s ease'
          : undefined,
        ...style[state],
      }}
    >
      {letter}
    </div>
  );
}

// ── Key ───────────────────────────────────────────────────────────────────────
function Key({ label, state, onClick }: {
  label: string;
  state?: LetterState;
  onClick: (k: string) => void;
}) {
  const isWide = label === 'ENTER' || label === '⌫';
  const bg     = state==='correct'?'rgba(0,212,255,0.22)':state==='present'?'rgba(245,158,11,0.20)':state==='absent'?'rgba(255,255,255,0.04)':'rgba(255,255,255,0.10)';
  const border = state==='correct'?'1px solid rgba(0,212,255,0.55)':state==='present'?'1px solid rgba(245,158,11,0.50)':state==='absent'?'1px solid rgba(255,255,255,0.06)':'1px solid rgba(255,255,255,0.17)';
  const color  = state==='correct'?'#00d4ff':state==='present'?'#f59e0b':state==='absent'?'rgba(255,255,255,0.28)':'var(--text-primary)';

  return (
    <button
      onClick={() => onClick(label === '⌫' ? 'BACKSPACE' : label)}
      style={{
        width: isWide ? 52 : 32, height: 42,
        borderRadius: 7, background: bg, border, color,
        fontSize: isWide ? 9 : 12, fontWeight: 700,
        letterSpacing: isWide ? 0.5 : 0,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'background 0.12s', userSelect: 'none',
      }}
    >
      {label}
    </button>
  );
}

// ── HintStrip ────────────────────────────────────────────────────────────────
function HintStrip({ letters }: { letters: (string | null)[] }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ fontSize: 10, color: '#a855f7', opacity: 0.8, textTransform: 'uppercase', letterSpacing: 2 }}>
        Hints
      </span>
      <div className="flex gap-1.5">
        {letters.map((h, i) => (
          <div key={i} style={{
            width: 26, height: 26,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 6, fontSize: 12, fontWeight: 800,
            background: h ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.04)',
            border:     h ? '1px solid rgba(168,85,247,0.60)' : '1px solid rgba(255,255,255,0.08)',
            color:      h ? '#a855f7' : 'transparent',
            boxShadow:  h ? '0 0 10px rgba(168,85,247,0.30)' : 'none',
            transition: 'all 0.25s',
          }}>
            {h ?? ''}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function Wordle() {
  const { selectGame } = useCornerStore();

  const [{ answer, startHint }, setGame] = useState(() => pickGame());

  const [guesses, setGuesses]   = useState<string[]>([]);
  const [evals, setEvals]       = useState<LetterState[][]>([]);
  const [currentGuess, setCurrent] = useState('');
  const [gameStatus, setStatus] = useState<GameStatus>('playing');
  const [hintsUsed, setHintsUsed]   = useState(0);
  const [hintLetters, setHintLetters] = useState<(string | null)[]>(() => pickGame().startHint);
  const [showHintPrompt, setShowHintPrompt] = useState(false);
  const [revealingRow, setRevealingRow]     = useState<number | null>(null);
  const [shakeRow, setShakeRow]             = useState(false);
  const [score, setScore]   = useState(0);
  const [bestScore, setBest] = useState(() => {
    try { return parseInt(localStorage.getItem(HS_KEY) ?? '0', 10); } catch { return 0; }
  });

  // Sync hintLetters with answer on init (fix the double-call issue)
  useEffect(() => { setHintLetters(startHint); }, [answer]); // eslint-disable-line

  const wordLen  = answer.length;
  const tileSize = tileSizeFor(wordLen);

  // Keyboard letter states
  const kbStates = useCallback((): Record<string, LetterState> => {
    const s: Record<string, LetterState> = {};
    evals.forEach((ev, gi) => {
      ev.forEach((state, li) => {
        const l = guesses[gi][li].toUpperCase();
        const prev = s[l];
        if (!prev || state === 'correct' || (state === 'present' && prev === 'absent')) s[l] = state;
      });
    });
    return s;
  }, [evals, guesses]);

  const submitGuess = useCallback(() => {
    if (revealingRow !== null) return;
    // Only check length — no word-list gate
    if (currentGuess.length !== wordLen) {
      setShakeRow(true);
      setTimeout(() => setShakeRow(false), 600);
      return;
    }

    const g          = currentGuess.toLowerCase();
    const ev         = evaluate(g, answer);
    const newGuesses = [...guesses, g];
    const newEvals   = [...evals, ev];
    const rowIdx     = newGuesses.length - 1;

    setGuesses(newGuesses);
    setEvals(newEvals);        // set immediately so animation can reveal them
    setCurrent('');
    setRevealingRow(rowIdx);

    const REVEAL_MS = wordLen * 160 + 600;

    setTimeout(() => {
      setRevealingRow(null);

      const won        = g === answer;
      const guessCount = newGuesses.length;

      if (won) {
        const base  = SCORE_TABLE[guessCount - 1] ?? 0;
        const final = Math.max(0, base - hintsUsed * HINT_COST);
        setScore(final);
        setStatus('won');
        setBest(prev => {
          const best = Math.max(prev, final);
          try { localStorage.setItem(HS_KEY, best.toString()); } catch { /* noop */ }
          return best;
        });
      } else if (guessCount >= MAX_GUESSES) {
        setScore(0);
        setStatus('lost');
      } else {
        setShowHintPrompt(true);
      }
    }, REVEAL_MS);
  }, [revealingRow, currentGuess, wordLen, answer, guesses, evals, hintsUsed]);

  const handleKey = useCallback((key: string) => {
    if (gameStatus !== 'playing') return;
    if (revealingRow !== null)    return;
    if (showHintPrompt)           return;

    if (key === 'ENTER') {
      submitGuess();
    } else if (key === 'BACKSPACE') {
      setCurrent(p => p.slice(0, -1));
    } else if (/^[A-Z]$/i.test(key) && currentGuess.length < wordLen) {
      setCurrent(p => p + key.toUpperCase());
    }
  }, [gameStatus, revealingRow, showHintPrompt, currentGuess, wordLen, submitGuess]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === 'Backspace')  handleKey('BACKSPACE');
      else if (e.key === 'Enter') handleKey('ENTER');
      else if (e.key.length === 1) handleKey(e.key.toUpperCase());
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleKey]);

  const useHintFn = useCallback(() => {
    const revealed = new Set<number>();
    hintLetters.forEach((h, i) => { if (h) revealed.add(i); });
    evals.forEach(ev => { ev.forEach((s, i) => { if (s === 'correct') revealed.add(i); }); });
    const candidates = Array.from({ length: wordLen }, (_, i) => i).filter(i => !revealed.has(i));
    if (!candidates.length) { setShowHintPrompt(false); return; }
    const pos = candidates[Math.floor(Math.random() * candidates.length)];
    setHintLetters(prev => { const n = [...prev]; n[pos] = answer[pos].toUpperCase(); return n; });
    setHintsUsed(p => p + 1);
    setShowHintPrompt(false);
  }, [hintLetters, evals, wordLen, answer]);

  const resetGame = useCallback(() => {
    const next = pickGame();
    setGame(next);
    setGuesses([]);
    setEvals([]);
    setCurrent('');
    setStatus('playing');
    setHintsUsed(0);
    setHintLetters(next.startHint);
    setShowHintPrompt(false);
    setRevealingRow(null);
    setShakeRow(false);
    setScore(0);
  }, []);

  const kb           = kbStates();
  const currentRowIdx = guesses.length;

  // Build display rows
  const rows = Array.from({ length: MAX_GUESSES }, (_, i) => {
    const isRevealing = i === revealingRow;
    if (i < guesses.length) {
      return {
        letters: guesses[i].toUpperCase().split(''),
        // During flip: show 'tbd' so the CSS brightness-at-0% hides the color before reveal
        cellEvals: isRevealing
          ? Array(wordLen).fill('tbd' as LetterState)
          : evals[i],
        isRevealing,
      };
    }
    if (i === currentRowIdx && gameStatus === 'playing') {
      const letters = currentGuess.split('');
      while (letters.length < wordLen) letters.push('');
      return {
        letters,
        cellEvals: letters.map(l => (l ? 'tbd' : 'empty') as LetterState),
        isRevealing: false,
      };
    }
    return {
      letters: Array(wordLen).fill(''),
      cellEvals: Array(wordLen).fill('empty' as LetterState),
      isRevealing: false,
    };
  });

  return (
    <div className="flex h-full flex-col select-none">
      <style>{`
        @keyframes wrd-flip {
          0%   { transform: scaleY(1); filter: brightness(0.3); }
          44%  { transform: scaleY(0); filter: brightness(0.3); }
          56%  { transform: scaleY(0); filter: brightness(1);   }
          100% { transform: scaleY(1); filter: brightness(1);   }
        }
        @keyframes wrd-pop {
          0%   { transform: scale(1);    }
          50%  { transform: scale(1.14); }
          100% { transform: scale(1);    }
        }
        @keyframes wrd-shake {
          0%,100% { transform: translateX(0);   }
          20%     { transform: translateX(-6px); }
          40%     { transform: translateX(6px);  }
          60%     { transform: translateX(-4px); }
          80%     { transform: translateX(4px);  }
        }
        @keyframes wrd-result-in {
          from { opacity: 0; transform: scale(0.93); }
          to   { opacity: 1; transform: scale(1);    }
        }
        @keyframes wrd-hint-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>

      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 px-4 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--panel-divider)' }}
      >
        <button
          onClick={() => selectGame(null)}
          className="flex h-8 w-8 items-center justify-center rounded-xl flex-shrink-0"
          style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)', color:'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.12)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.06)'}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0"
          style={{ background:'rgba(168,85,247,0.15)', border:'1px solid rgba(168,85,247,0.30)', fontSize: 18 }}
        >
          🟩
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-base font-bold" style={{ color:'var(--text-primary)' }}>Wordle</p>
          <p className="text-xs" style={{ color:'var(--text-muted)' }}>
            {wordLen}-letter word · {MAX_GUESSES} tries
          </p>
        </div>

        <div className="text-right flex-shrink-0 mr-1">
          <p className="text-[10px] uppercase tracking-wider" style={{ color:'var(--text-muted)' }}>Best</p>
          <p className="text-sm font-bold" style={{ color:'#a855f7' }}>{bestScore}</p>
        </div>

        <button
          onClick={resetGame}
          className="flex h-8 w-8 items-center justify-center rounded-xl flex-shrink-0"
          style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)', color:'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.12)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.06)'}
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {/* ── Game area ── */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center gap-3 py-4 px-3">

        {/* Hint strip — always visible (starts with one free letter) */}
        <HintStrip letters={hintLetters} />

        {/* Grid */}
        <div className="flex flex-col gap-1.5">
          {rows.map((row, ri) => {
            const isCurrentShaking = ri === currentRowIdx && shakeRow;
            return (
              <div
                key={ri}
                className="flex gap-1.5"
                style={isCurrentShaking ? { animation: 'wrd-shake 0.55s ease' } : undefined}
              >
                {row.letters.map((letter, li) => (
                  <Tile
                    key={li}
                    letter={letter}
                    state={row.cellEvals[li]}
                    size={tileSize}
                    isRevealing={row.isRevealing}
                    animDelay={li * 0.16}
                  />
                ))}
              </div>
            );
          })}
        </div>

        {/* Hint prompt — appears after each wrong guess */}
        {showHintPrompt && gameStatus === 'playing' && (
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{
              animation: 'wrd-hint-in 0.28s ease',
              background: 'rgba(168,85,247,0.10)',
              border: '1px solid rgba(168,85,247,0.32)',
              boxShadow: '0 0 20px rgba(168,85,247,0.12)',
              maxWidth: 310, width: '100%',
            }}
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl flex-shrink-0"
              style={{ background:'rgba(168,85,247,0.18)', border:'1px solid rgba(168,85,247,0.45)' }}
            >
              <Lightbulb className="h-4 w-4" style={{ color:'#a855f7' }} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold" style={{ color:'#a855f7' }}>Reveal a letter?</p>
              <p className="text-[10px]" style={{ color:'var(--text-muted)' }}>
                Costs {HINT_COST} pts from your final score
              </p>
            </div>

            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={useHintFn}
                className="rounded-xl px-3 py-1.5 text-[11px] font-bold"
                style={{ background:'rgba(168,85,247,0.22)', border:'1px solid rgba(168,85,247,0.52)', color:'#a855f7' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(168,85,247,0.35)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='rgba(168,85,247,0.22)'}
              >
                Reveal
              </button>
              <button
                onClick={() => setShowHintPrompt(false)}
                className="rounded-xl px-3 py-1.5 text-[11px] font-bold"
                style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', color:'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.10)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.06)'}
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Result panel */}
        {gameStatus !== 'playing' && (
          <div
            className="flex flex-col items-center gap-3 rounded-2xl px-6 py-5 text-center"
            style={{
              animation: 'wrd-result-in 0.38s ease',
              background: gameStatus==='won' ? 'rgba(0,212,255,0.08)' : 'rgba(239,68,68,0.08)',
              border:     gameStatus==='won' ? '1px solid rgba(0,212,255,0.28)' : '1px solid rgba(239,68,68,0.28)',
              maxWidth: 310, width: '100%',
            }}
          >
            <span style={{ fontSize: 28 }}>{gameStatus==='won' ? '🎉' : '😔'}</span>

            <div>
              <p className="text-base font-bold" style={{ color: gameStatus==='won' ? '#00d4ff' : '#ef4444' }}>
                {gameStatus==='won' ? 'Brilliant!' : 'Better luck next time'}
              </p>
              {gameStatus==='lost' && (
                <p className="text-sm mt-1" style={{ color:'var(--text-muted)' }}>
                  The word was{' '}
                  <span style={{ color:'#00d4ff', fontWeight: 700 }}>{answer.toUpperCase()}</span>
                </p>
              )}
            </div>

            {gameStatus==='won' && (
              <div className="flex gap-5">
                <div className="text-center">
                  <p className="text-xl font-bold" style={{ color:'#00d4ff' }}>{score}</p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color:'var(--text-muted)' }}>Score</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold" style={{ color:'#a855f7' }}>{bestScore}</p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color:'var(--text-muted)' }}>Best</p>
                </div>
                {hintsUsed > 0 && (
                  <div className="text-center">
                    <p className="text-xl font-bold" style={{ color:'rgba(255,255,255,0.35)' }}>-{hintsUsed * HINT_COST}</p>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color:'var(--text-muted)' }}>Hints</p>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={resetGame}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold"
              style={{ background:'rgba(0,212,255,0.14)', border:'1px solid rgba(0,212,255,0.38)', color:'#00d4ff' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(0,212,255,0.24)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='rgba(0,212,255,0.14)'}
            >
              <RotateCcw className="h-4 w-4" />
              Play Again
            </button>
          </div>
        )}

        {/* Keyboard */}
        <div className="flex flex-col items-center gap-1.5 mt-auto pt-1">
          {KEYBOARD_ROWS.map((row, ri) => (
            <div key={ri} className="flex gap-1.5">
              {row.map(key => (
                <Key key={key} label={key} state={kb[key]} onClick={handleKey} />
              ))}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
