# Emoji & GIF Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a custom emoji picker + Tenor GIF search/send panel to both DM ChatWindow and server BubbleChat.

**Architecture:** A single shared `EmojiGifPicker` component with two tabs (Emoji grid, GIF search via Tenor API). Emoji data is a static TypeScript file. GIF messages use a `_gif` JSON flag matching the existing `_voice`/`_file` pattern. An `IntersectionObserver` pauses offscreen GIFs.

**Tech Stack:** React, Tenor REST API v2, native Unicode emojis, localStorage for recents.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/emojiData.ts` | Create | Static emoji dataset grouped by category + search helper |
| `src/lib/tenor.ts` | Create | Tenor API client: `fetchTrending()`, `searchGifs()` |
| `src/components/ui/EmojiGifPicker.tsx` | Create | Tabbed popover: emoji grid + GIF search |
| `src/components/chat/ChatWindow.tsx` | Modify | Add picker trigger in input, GIF message detection + rendering |
| `src/components/servers/BubbleChat.tsx` | Modify | Same: picker trigger, GIF detection + rendering |
| `.env.example` | Modify | Add `VITE_TENOR_API_KEY` |

---

### Task 1: Emoji Data Module

**Files:**
- Create: `src/lib/emojiData.ts`

- [ ] **Step 1: Create the emoji data file with categories and search**

Create `src/lib/emojiData.ts`. This file contains a curated emoji list (the most commonly used ~400 emojis across 9 categories) and a search function. We use a hardcoded array instead of a massive JSON import to keep bundle size small.

```ts
// src/lib/emojiData.ts

export interface EmojiEntry {
  emoji: string;
  name: string;
  keywords: string[];
  category: string;
}

export const EMOJI_CATEGORIES = [
  { id: 'smileys', label: 'Smileys & Emotion', icon: '😊' },
  { id: 'people', label: 'People & Body', icon: '👋' },
  { id: 'animals', label: 'Animals & Nature', icon: '🐶' },
  { id: 'food', label: 'Food & Drink', icon: '🍕' },
  { id: 'activities', label: 'Activities', icon: '⚽' },
  { id: 'travel', label: 'Travel & Places', icon: '🚗' },
  { id: 'objects', label: 'Objects', icon: '💡' },
  { id: 'symbols', label: 'Symbols', icon: '❤️' },
  { id: 'flags', label: 'Flags', icon: '🏳️' },
] as const;

export type CategoryId = typeof EMOJI_CATEGORIES[number]['id'];

// Full emoji dataset — ~400 most-used emojis
export const EMOJIS: EmojiEntry[] = [
  // ── Smileys & Emotion ──
  { emoji: '😀', name: 'grinning face', keywords: ['happy', 'smile', 'grin'], category: 'smileys' },
  { emoji: '😁', name: 'beaming face', keywords: ['happy', 'grin', 'teeth'], category: 'smileys' },
  { emoji: '😂', name: 'face with tears of joy', keywords: ['laugh', 'cry', 'lol', 'funny'], category: 'smileys' },
  { emoji: '🤣', name: 'rolling on the floor laughing', keywords: ['laugh', 'rofl', 'lmao'], category: 'smileys' },
  { emoji: '😃', name: 'grinning face with big eyes', keywords: ['happy', 'smile'], category: 'smileys' },
  { emoji: '😄', name: 'grinning face with smiling eyes', keywords: ['happy', 'smile'], category: 'smileys' },
  { emoji: '😅', name: 'grinning face with sweat', keywords: ['nervous', 'awkward'], category: 'smileys' },
  { emoji: '😆', name: 'grinning squinting face', keywords: ['laugh', 'happy'], category: 'smileys' },
  { emoji: '😉', name: 'winking face', keywords: ['wink', 'flirt'], category: 'smileys' },
  { emoji: '😊', name: 'smiling face with smiling eyes', keywords: ['happy', 'blush', 'cute'], category: 'smileys' },
  { emoji: '😋', name: 'face savoring food', keywords: ['yum', 'delicious', 'tongue'], category: 'smileys' },
  { emoji: '😎', name: 'smiling face with sunglasses', keywords: ['cool', 'sunglasses'], category: 'smileys' },
  { emoji: '😍', name: 'smiling face with heart-eyes', keywords: ['love', 'heart', 'crush'], category: 'smileys' },
  { emoji: '😘', name: 'face blowing a kiss', keywords: ['kiss', 'love'], category: 'smileys' },
  { emoji: '🥰', name: 'smiling face with hearts', keywords: ['love', 'hearts', 'adore'], category: 'smileys' },
  { emoji: '😗', name: 'kissing face', keywords: ['kiss'], category: 'smileys' },
  { emoji: '🤗', name: 'hugging face', keywords: ['hug', 'embrace'], category: 'smileys' },
  { emoji: '🤩', name: 'star-struck', keywords: ['wow', 'star', 'excited'], category: 'smileys' },
  { emoji: '🤔', name: 'thinking face', keywords: ['think', 'hmm', 'consider'], category: 'smileys' },
  { emoji: '🤨', name: 'face with raised eyebrow', keywords: ['skeptical', 'suspicious'], category: 'smileys' },
  { emoji: '😐', name: 'neutral face', keywords: ['meh', 'neutral', 'blank'], category: 'smileys' },
  { emoji: '😑', name: 'expressionless face', keywords: ['blank', 'annoyed'], category: 'smileys' },
  { emoji: '😶', name: 'face without mouth', keywords: ['silent', 'speechless'], category: 'smileys' },
  { emoji: '🙄', name: 'face with rolling eyes', keywords: ['eyeroll', 'annoyed', 'whatever'], category: 'smileys' },
  { emoji: '😏', name: 'smirking face', keywords: ['smirk', 'sly'], category: 'smileys' },
  { emoji: '😣', name: 'persevering face', keywords: ['struggle', 'frustrated'], category: 'smileys' },
  { emoji: '😥', name: 'sad but relieved face', keywords: ['sad', 'relief', 'sweat'], category: 'smileys' },
  { emoji: '😮', name: 'face with open mouth', keywords: ['surprise', 'shock', 'wow'], category: 'smileys' },
  { emoji: '🤐', name: 'zipper-mouth face', keywords: ['secret', 'quiet', 'zip'], category: 'smileys' },
  { emoji: '😯', name: 'hushed face', keywords: ['surprise', 'quiet'], category: 'smileys' },
  { emoji: '😪', name: 'sleepy face', keywords: ['tired', 'sleep'], category: 'smileys' },
  { emoji: '😫', name: 'tired face', keywords: ['tired', 'exhausted', 'whine'], category: 'smileys' },
  { emoji: '🥱', name: 'yawning face', keywords: ['yawn', 'tired', 'bored'], category: 'smileys' },
  { emoji: '😴', name: 'sleeping face', keywords: ['sleep', 'zzz'], category: 'smileys' },
  { emoji: '😌', name: 'relieved face', keywords: ['relieved', 'calm', 'peace'], category: 'smileys' },
  { emoji: '😛', name: 'face with tongue', keywords: ['tongue', 'silly', 'playful'], category: 'smileys' },
  { emoji: '😜', name: 'winking face with tongue', keywords: ['tongue', 'wink', 'silly'], category: 'smileys' },
  { emoji: '😝', name: 'squinting face with tongue', keywords: ['tongue', 'silly'], category: 'smileys' },
  { emoji: '🤤', name: 'drooling face', keywords: ['drool', 'hungry'], category: 'smileys' },
  { emoji: '😒', name: 'unamused face', keywords: ['unamused', 'bored', 'meh'], category: 'smileys' },
  { emoji: '😓', name: 'downcast face with sweat', keywords: ['sad', 'sweat', 'tired'], category: 'smileys' },
  { emoji: '😔', name: 'pensive face', keywords: ['sad', 'pensive', 'thoughtful'], category: 'smileys' },
  { emoji: '😕', name: 'confused face', keywords: ['confused', 'unsure'], category: 'smileys' },
  { emoji: '🙃', name: 'upside-down face', keywords: ['sarcasm', 'silly', 'upside down'], category: 'smileys' },
  { emoji: '🤑', name: 'money-mouth face', keywords: ['money', 'rich', 'dollar'], category: 'smileys' },
  { emoji: '😲', name: 'astonished face', keywords: ['shocked', 'surprised', 'wow'], category: 'smileys' },
  { emoji: '🙁', name: 'slightly frowning face', keywords: ['sad', 'frown'], category: 'smileys' },
  { emoji: '😤', name: 'face with steam from nose', keywords: ['angry', 'frustrated', 'huff'], category: 'smileys' },
  { emoji: '😢', name: 'crying face', keywords: ['cry', 'sad', 'tear'], category: 'smileys' },
  { emoji: '😭', name: 'loudly crying face', keywords: ['cry', 'sob', 'sad'], category: 'smileys' },
  { emoji: '😧', name: 'anguished face', keywords: ['anguish', 'pain', 'shocked'], category: 'smileys' },
  { emoji: '😨', name: 'fearful face', keywords: ['fear', 'scared', 'shock'], category: 'smileys' },
  { emoji: '😩', name: 'weary face', keywords: ['weary', 'tired', 'frustrated'], category: 'smileys' },
  { emoji: '🤯', name: 'exploding head', keywords: ['mind blown', 'shock', 'wow'], category: 'smileys' },
  { emoji: '😬', name: 'grimacing face', keywords: ['grimace', 'awkward', 'teeth'], category: 'smileys' },
  { emoji: '😱', name: 'face screaming in fear', keywords: ['scream', 'horror', 'omg'], category: 'smileys' },
  { emoji: '😳', name: 'flushed face', keywords: ['blush', 'embarrassed', 'flushed'], category: 'smileys' },
  { emoji: '🥵', name: 'hot face', keywords: ['hot', 'heat', 'sweat'], category: 'smileys' },
  { emoji: '🥶', name: 'cold face', keywords: ['cold', 'freeze', 'ice'], category: 'smileys' },
  { emoji: '😡', name: 'pouting face', keywords: ['angry', 'mad', 'rage'], category: 'smileys' },
  { emoji: '😠', name: 'angry face', keywords: ['angry', 'mad'], category: 'smileys' },
  { emoji: '🤬', name: 'face with symbols on mouth', keywords: ['swear', 'curse', 'angry'], category: 'smileys' },
  { emoji: '😈', name: 'smiling face with horns', keywords: ['devil', 'evil', 'naughty'], category: 'smileys' },
  { emoji: '👿', name: 'angry face with horns', keywords: ['devil', 'evil', 'angry'], category: 'smileys' },
  { emoji: '💀', name: 'skull', keywords: ['dead', 'death', 'skeleton'], category: 'smileys' },
  { emoji: '☠️', name: 'skull and crossbones', keywords: ['dead', 'danger', 'poison'], category: 'smileys' },
  { emoji: '💩', name: 'pile of poo', keywords: ['poop', 'shit', 'crap'], category: 'smileys' },
  { emoji: '🤡', name: 'clown face', keywords: ['clown', 'funny', 'silly'], category: 'smileys' },
  { emoji: '👹', name: 'ogre', keywords: ['monster', 'scary'], category: 'smileys' },
  { emoji: '👻', name: 'ghost', keywords: ['ghost', 'spooky', 'halloween'], category: 'smileys' },
  { emoji: '👽', name: 'alien', keywords: ['alien', 'ufo', 'space'], category: 'smileys' },
  { emoji: '🤖', name: 'robot', keywords: ['robot', 'bot', 'machine'], category: 'smileys' },
  { emoji: '😺', name: 'grinning cat', keywords: ['cat', 'happy'], category: 'smileys' },
  { emoji: '😹', name: 'cat with tears of joy', keywords: ['cat', 'laugh'], category: 'smileys' },
  { emoji: '😻', name: 'smiling cat with heart-eyes', keywords: ['cat', 'love'], category: 'smileys' },
  { emoji: '🙈', name: 'see-no-evil monkey', keywords: ['monkey', 'hide', 'shy'], category: 'smileys' },
  { emoji: '🙉', name: 'hear-no-evil monkey', keywords: ['monkey', 'deaf'], category: 'smileys' },
  { emoji: '🙊', name: 'speak-no-evil monkey', keywords: ['monkey', 'quiet', 'oops'], category: 'smileys' },
  { emoji: '🥺', name: 'pleading face', keywords: ['please', 'puppy eyes', 'beg'], category: 'smileys' },
  { emoji: '🫠', name: 'melting face', keywords: ['melt', 'hot', 'embarrassed'], category: 'smileys' },
  { emoji: '🫡', name: 'saluting face', keywords: ['salute', 'yes sir'], category: 'smileys' },
  { emoji: '🫢', name: 'face with open eyes and hand over mouth', keywords: ['oops', 'surprise'], category: 'smileys' },
  { emoji: '🫣', name: 'face with peeking eye', keywords: ['peek', 'shy', 'scared'], category: 'smileys' },
  { emoji: '🫤', name: 'face with diagonal mouth', keywords: ['meh', 'unsure', 'skeptical'], category: 'smileys' },

  // ── People & Body ──
  { emoji: '👋', name: 'waving hand', keywords: ['wave', 'hello', 'bye'], category: 'people' },
  { emoji: '🤚', name: 'raised back of hand', keywords: ['hand', 'stop'], category: 'people' },
  { emoji: '🖐️', name: 'hand with fingers splayed', keywords: ['hand', 'five', 'high five'], category: 'people' },
  { emoji: '✋', name: 'raised hand', keywords: ['hand', 'stop', 'high five'], category: 'people' },
  { emoji: '🖖', name: 'vulcan salute', keywords: ['spock', 'star trek'], category: 'people' },
  { emoji: '👌', name: 'OK hand', keywords: ['ok', 'perfect', 'good'], category: 'people' },
  { emoji: '🤌', name: 'pinched fingers', keywords: ['italian', 'what', 'chef kiss'], category: 'people' },
  { emoji: '✌️', name: 'victory hand', keywords: ['peace', 'victory', 'two'], category: 'people' },
  { emoji: '🤞', name: 'crossed fingers', keywords: ['luck', 'hope', 'fingers crossed'], category: 'people' },
  { emoji: '🫰', name: 'hand with index finger and thumb crossed', keywords: ['money', 'snap'], category: 'people' },
  { emoji: '🤟', name: 'love-you gesture', keywords: ['love', 'rock'], category: 'people' },
  { emoji: '🤘', name: 'sign of the horns', keywords: ['rock', 'metal', 'horns'], category: 'people' },
  { emoji: '🤙', name: 'call me hand', keywords: ['call', 'shaka', 'hang loose'], category: 'people' },
  { emoji: '👈', name: 'backhand index pointing left', keywords: ['left', 'point'], category: 'people' },
  { emoji: '👉', name: 'backhand index pointing right', keywords: ['right', 'point'], category: 'people' },
  { emoji: '👆', name: 'backhand index pointing up', keywords: ['up', 'point'], category: 'people' },
  { emoji: '👇', name: 'backhand index pointing down', keywords: ['down', 'point'], category: 'people' },
  { emoji: '☝️', name: 'index pointing up', keywords: ['up', 'point', 'one'], category: 'people' },
  { emoji: '👍', name: 'thumbs up', keywords: ['yes', 'good', 'like', 'approve'], category: 'people' },
  { emoji: '👎', name: 'thumbs down', keywords: ['no', 'bad', 'dislike'], category: 'people' },
  { emoji: '✊', name: 'raised fist', keywords: ['fist', 'power', 'punch'], category: 'people' },
  { emoji: '👊', name: 'oncoming fist', keywords: ['punch', 'fist bump'], category: 'people' },
  { emoji: '🤛', name: 'left-facing fist', keywords: ['fist bump'], category: 'people' },
  { emoji: '🤜', name: 'right-facing fist', keywords: ['fist bump'], category: 'people' },
  { emoji: '👏', name: 'clapping hands', keywords: ['clap', 'applause', 'bravo'], category: 'people' },
  { emoji: '🙌', name: 'raising hands', keywords: ['hooray', 'celebrate', 'praise'], category: 'people' },
  { emoji: '🫶', name: 'heart hands', keywords: ['love', 'heart', 'hands'], category: 'people' },
  { emoji: '👐', name: 'open hands', keywords: ['hands', 'open'], category: 'people' },
  { emoji: '🤲', name: 'palms up together', keywords: ['pray', 'please'], category: 'people' },
  { emoji: '🤝', name: 'handshake', keywords: ['deal', 'agree', 'partnership'], category: 'people' },
  { emoji: '🙏', name: 'folded hands', keywords: ['pray', 'please', 'thank you', 'namaste'], category: 'people' },
  { emoji: '💪', name: 'flexed biceps', keywords: ['strong', 'muscle', 'flex', 'gym'], category: 'people' },
  { emoji: '🦾', name: 'mechanical arm', keywords: ['robot', 'prosthetic', 'strong'], category: 'people' },
  { emoji: '🫂', name: 'people hugging', keywords: ['hug', 'embrace'], category: 'people' },

  // ── Animals & Nature ──
  { emoji: '🐶', name: 'dog face', keywords: ['dog', 'puppy', 'pet'], category: 'animals' },
  { emoji: '🐱', name: 'cat face', keywords: ['cat', 'kitten', 'pet'], category: 'animals' },
  { emoji: '🐭', name: 'mouse face', keywords: ['mouse', 'rat'], category: 'animals' },
  { emoji: '🐹', name: 'hamster', keywords: ['hamster', 'pet'], category: 'animals' },
  { emoji: '🐰', name: 'rabbit face', keywords: ['rabbit', 'bunny'], category: 'animals' },
  { emoji: '🦊', name: 'fox', keywords: ['fox', 'clever'], category: 'animals' },
  { emoji: '🐻', name: 'bear', keywords: ['bear', 'teddy'], category: 'animals' },
  { emoji: '🐼', name: 'panda', keywords: ['panda', 'bear'], category: 'animals' },
  { emoji: '🐨', name: 'koala', keywords: ['koala', 'cute'], category: 'animals' },
  { emoji: '🐯', name: 'tiger face', keywords: ['tiger', 'cat'], category: 'animals' },
  { emoji: '🦁', name: 'lion', keywords: ['lion', 'king', 'cat'], category: 'animals' },
  { emoji: '🐸', name: 'frog', keywords: ['frog', 'toad'], category: 'animals' },
  { emoji: '🐵', name: 'monkey face', keywords: ['monkey', 'ape'], category: 'animals' },
  { emoji: '🐔', name: 'chicken', keywords: ['chicken', 'hen'], category: 'animals' },
  { emoji: '🐧', name: 'penguin', keywords: ['penguin', 'cold'], category: 'animals' },
  { emoji: '🐦', name: 'bird', keywords: ['bird', 'tweet'], category: 'animals' },
  { emoji: '🦅', name: 'eagle', keywords: ['eagle', 'bird', 'freedom'], category: 'animals' },
  { emoji: '🦋', name: 'butterfly', keywords: ['butterfly', 'beautiful'], category: 'animals' },
  { emoji: '🐛', name: 'bug', keywords: ['bug', 'insect'], category: 'animals' },
  { emoji: '🐝', name: 'honeybee', keywords: ['bee', 'honey'], category: 'animals' },
  { emoji: '🐍', name: 'snake', keywords: ['snake', 'python'], category: 'animals' },
  { emoji: '🐢', name: 'turtle', keywords: ['turtle', 'slow'], category: 'animals' },
  { emoji: '🐠', name: 'tropical fish', keywords: ['fish', 'tropical'], category: 'animals' },
  { emoji: '🐬', name: 'dolphin', keywords: ['dolphin', 'ocean'], category: 'animals' },
  { emoji: '🦈', name: 'shark', keywords: ['shark', 'jaws'], category: 'animals' },
  { emoji: '🐙', name: 'octopus', keywords: ['octopus', 'tentacle'], category: 'animals' },
  { emoji: '🌸', name: 'cherry blossom', keywords: ['flower', 'spring', 'pink'], category: 'animals' },
  { emoji: '🌹', name: 'rose', keywords: ['flower', 'rose', 'love', 'romantic'], category: 'animals' },
  { emoji: '🌻', name: 'sunflower', keywords: ['flower', 'sun', 'happy'], category: 'animals' },
  { emoji: '🌲', name: 'evergreen tree', keywords: ['tree', 'pine', 'forest'], category: 'animals' },
  { emoji: '🍀', name: 'four leaf clover', keywords: ['luck', 'clover', 'irish'], category: 'animals' },
  { emoji: '🔥', name: 'fire', keywords: ['fire', 'hot', 'flame', 'lit'], category: 'animals' },
  { emoji: '🌈', name: 'rainbow', keywords: ['rainbow', 'colorful'], category: 'animals' },
  { emoji: '⭐', name: 'star', keywords: ['star', 'shine', 'favorite'], category: 'animals' },
  { emoji: '🌙', name: 'crescent moon', keywords: ['moon', 'night', 'sleep'], category: 'animals' },
  { emoji: '☀️', name: 'sun', keywords: ['sun', 'bright', 'hot', 'day'], category: 'animals' },
  { emoji: '⚡', name: 'high voltage', keywords: ['lightning', 'electric', 'zap', 'thunder'], category: 'animals' },
  { emoji: '💧', name: 'droplet', keywords: ['water', 'drop', 'sweat'], category: 'animals' },
  { emoji: '❄️', name: 'snowflake', keywords: ['snow', 'cold', 'winter', 'ice'], category: 'animals' },

  // ── Food & Drink ──
  { emoji: '🍕', name: 'pizza', keywords: ['pizza', 'food', 'italian'], category: 'food' },
  { emoji: '🍔', name: 'hamburger', keywords: ['burger', 'food', 'fast food'], category: 'food' },
  { emoji: '🍟', name: 'french fries', keywords: ['fries', 'food', 'fast food'], category: 'food' },
  { emoji: '🌭', name: 'hot dog', keywords: ['hotdog', 'food'], category: 'food' },
  { emoji: '🍿', name: 'popcorn', keywords: ['popcorn', 'movie', 'snack'], category: 'food' },
  { emoji: '🍦', name: 'soft ice cream', keywords: ['ice cream', 'dessert'], category: 'food' },
  { emoji: '🍩', name: 'doughnut', keywords: ['donut', 'dessert', 'sweet'], category: 'food' },
  { emoji: '🍪', name: 'cookie', keywords: ['cookie', 'dessert', 'sweet'], category: 'food' },
  { emoji: '🎂', name: 'birthday cake', keywords: ['cake', 'birthday', 'celebration'], category: 'food' },
  { emoji: '🍰', name: 'shortcake', keywords: ['cake', 'dessert'], category: 'food' },
  { emoji: '🧁', name: 'cupcake', keywords: ['cupcake', 'dessert', 'sweet'], category: 'food' },
  { emoji: '☕', name: 'hot beverage', keywords: ['coffee', 'tea', 'drink'], category: 'food' },
  { emoji: '🍺', name: 'beer mug', keywords: ['beer', 'drink', 'alcohol'], category: 'food' },
  { emoji: '🍷', name: 'wine glass', keywords: ['wine', 'drink', 'alcohol'], category: 'food' },
  { emoji: '🥤', name: 'cup with straw', keywords: ['soda', 'drink', 'juice'], category: 'food' },
  { emoji: '🧃', name: 'beverage box', keywords: ['juice', 'drink'], category: 'food' },
  { emoji: '🍎', name: 'red apple', keywords: ['apple', 'fruit'], category: 'food' },
  { emoji: '🍌', name: 'banana', keywords: ['banana', 'fruit'], category: 'food' },
  { emoji: '🍇', name: 'grapes', keywords: ['grapes', 'fruit', 'wine'], category: 'food' },
  { emoji: '🍓', name: 'strawberry', keywords: ['strawberry', 'fruit', 'berry'], category: 'food' },
  { emoji: '🍑', name: 'peach', keywords: ['peach', 'fruit', 'butt'], category: 'food' },
  { emoji: '🥑', name: 'avocado', keywords: ['avocado', 'guacamole'], category: 'food' },
  { emoji: '🌶️', name: 'hot pepper', keywords: ['pepper', 'spicy', 'hot'], category: 'food' },
  { emoji: '🍣', name: 'sushi', keywords: ['sushi', 'japanese', 'food'], category: 'food' },
  { emoji: '🍜', name: 'steaming bowl', keywords: ['ramen', 'noodles', 'soup'], category: 'food' },
  { emoji: '🍝', name: 'spaghetti', keywords: ['pasta', 'italian', 'food'], category: 'food' },
  { emoji: '🌮', name: 'taco', keywords: ['taco', 'mexican', 'food'], category: 'food' },
  { emoji: '🥐', name: 'croissant', keywords: ['croissant', 'french', 'bread'], category: 'food' },

  // ── Activities ──
  { emoji: '⚽', name: 'soccer ball', keywords: ['soccer', 'football', 'sport'], category: 'activities' },
  { emoji: '🏀', name: 'basketball', keywords: ['basketball', 'sport', 'nba'], category: 'activities' },
  { emoji: '🏈', name: 'american football', keywords: ['football', 'nfl', 'sport'], category: 'activities' },
  { emoji: '⚾', name: 'baseball', keywords: ['baseball', 'sport'], category: 'activities' },
  { emoji: '🎾', name: 'tennis', keywords: ['tennis', 'sport'], category: 'activities' },
  { emoji: '🏐', name: 'volleyball', keywords: ['volleyball', 'sport'], category: 'activities' },
  { emoji: '🎮', name: 'video game', keywords: ['game', 'gaming', 'controller', 'play'], category: 'activities' },
  { emoji: '🎲', name: 'game die', keywords: ['dice', 'game', 'random', 'luck'], category: 'activities' },
  { emoji: '♟️', name: 'chess pawn', keywords: ['chess', 'game', 'strategy'], category: 'activities' },
  { emoji: '🎯', name: 'bullseye', keywords: ['target', 'dart', 'goal'], category: 'activities' },
  { emoji: '🎪', name: 'circus tent', keywords: ['circus', 'festival', 'fun'], category: 'activities' },
  { emoji: '🎭', name: 'performing arts', keywords: ['theater', 'drama', 'mask'], category: 'activities' },
  { emoji: '🎨', name: 'artist palette', keywords: ['art', 'paint', 'creative'], category: 'activities' },
  { emoji: '🎬', name: 'clapper board', keywords: ['movie', 'film', 'action'], category: 'activities' },
  { emoji: '🎤', name: 'microphone', keywords: ['mic', 'sing', 'karaoke', 'music'], category: 'activities' },
  { emoji: '🎧', name: 'headphone', keywords: ['music', 'listen', 'headphones'], category: 'activities' },
  { emoji: '🎵', name: 'musical note', keywords: ['music', 'note', 'song'], category: 'activities' },
  { emoji: '🎶', name: 'musical notes', keywords: ['music', 'song', 'melody'], category: 'activities' },
  { emoji: '🏆', name: 'trophy', keywords: ['trophy', 'win', 'champion', 'award'], category: 'activities' },
  { emoji: '🥇', name: 'gold medal', keywords: ['medal', 'first', 'winner', 'gold'], category: 'activities' },
  { emoji: '🎉', name: 'party popper', keywords: ['party', 'celebrate', 'congratulations'], category: 'activities' },
  { emoji: '🎊', name: 'confetti ball', keywords: ['confetti', 'party', 'celebrate'], category: 'activities' },
  { emoji: '🎁', name: 'wrapped gift', keywords: ['gift', 'present', 'birthday'], category: 'activities' },
  { emoji: '🎄', name: 'christmas tree', keywords: ['christmas', 'holiday', 'tree'], category: 'activities' },
  { emoji: '🎃', name: 'jack-o-lantern', keywords: ['halloween', 'pumpkin'], category: 'activities' },

  // ── Travel & Places ──
  { emoji: '🚗', name: 'automobile', keywords: ['car', 'drive', 'vehicle'], category: 'travel' },
  { emoji: '🚕', name: 'taxi', keywords: ['taxi', 'cab'], category: 'travel' },
  { emoji: '🚀', name: 'rocket', keywords: ['rocket', 'space', 'launch'], category: 'travel' },
  { emoji: '✈️', name: 'airplane', keywords: ['plane', 'fly', 'travel'], category: 'travel' },
  { emoji: '🚁', name: 'helicopter', keywords: ['helicopter', 'fly'], category: 'travel' },
  { emoji: '🚂', name: 'locomotive', keywords: ['train', 'railway'], category: 'travel' },
  { emoji: '⛵', name: 'sailboat', keywords: ['boat', 'sail', 'ocean'], category: 'travel' },
  { emoji: '🏠', name: 'house', keywords: ['house', 'home'], category: 'travel' },
  { emoji: '🏢', name: 'office building', keywords: ['office', 'work', 'building'], category: 'travel' },
  { emoji: '🏥', name: 'hospital', keywords: ['hospital', 'health', 'medical'], category: 'travel' },
  { emoji: '🏫', name: 'school', keywords: ['school', 'education'], category: 'travel' },
  { emoji: '⛪', name: 'church', keywords: ['church', 'religion'], category: 'travel' },
  { emoji: '🗽', name: 'statue of liberty', keywords: ['new york', 'america', 'liberty'], category: 'travel' },
  { emoji: '🗼', name: 'tokyo tower', keywords: ['tokyo', 'japan', 'tower'], category: 'travel' },
  { emoji: '🏝️', name: 'desert island', keywords: ['island', 'beach', 'tropical', 'vacation'], category: 'travel' },
  { emoji: '🏔️', name: 'snow-capped mountain', keywords: ['mountain', 'snow', 'nature'], category: 'travel' },
  { emoji: '🌋', name: 'volcano', keywords: ['volcano', 'eruption', 'lava'], category: 'travel' },
  { emoji: '🌍', name: 'globe showing Europe-Africa', keywords: ['earth', 'world', 'globe'], category: 'travel' },
  { emoji: '🌎', name: 'globe showing Americas', keywords: ['earth', 'world', 'globe'], category: 'travel' },

  // ── Objects ──
  { emoji: '💡', name: 'light bulb', keywords: ['idea', 'light', 'bulb'], category: 'objects' },
  { emoji: '🔦', name: 'flashlight', keywords: ['flashlight', 'torch', 'light'], category: 'objects' },
  { emoji: '💻', name: 'laptop', keywords: ['laptop', 'computer', 'code'], category: 'objects' },
  { emoji: '🖥️', name: 'desktop computer', keywords: ['computer', 'desktop', 'monitor'], category: 'objects' },
  { emoji: '📱', name: 'mobile phone', keywords: ['phone', 'mobile', 'cell'], category: 'objects' },
  { emoji: '⌨️', name: 'keyboard', keywords: ['keyboard', 'type', 'computer'], category: 'objects' },
  { emoji: '🖱️', name: 'computer mouse', keywords: ['mouse', 'click', 'computer'], category: 'objects' },
  { emoji: '📷', name: 'camera', keywords: ['camera', 'photo', 'picture'], category: 'objects' },
  { emoji: '📸', name: 'camera with flash', keywords: ['camera', 'photo', 'flash'], category: 'objects' },
  { emoji: '🎥', name: 'movie camera', keywords: ['camera', 'video', 'film'], category: 'objects' },
  { emoji: '📺', name: 'television', keywords: ['tv', 'television', 'watch'], category: 'objects' },
  { emoji: '🔊', name: 'speaker high volume', keywords: ['speaker', 'loud', 'volume'], category: 'objects' },
  { emoji: '🔔', name: 'bell', keywords: ['bell', 'notification', 'alert'], category: 'objects' },
  { emoji: '📚', name: 'books', keywords: ['books', 'read', 'library', 'study'], category: 'objects' },
  { emoji: '📝', name: 'memo', keywords: ['note', 'write', 'memo'], category: 'objects' },
  { emoji: '✏️', name: 'pencil', keywords: ['pencil', 'write', 'edit'], category: 'objects' },
  { emoji: '📌', name: 'pushpin', keywords: ['pin', 'location', 'mark'], category: 'objects' },
  { emoji: '📎', name: 'paperclip', keywords: ['paperclip', 'attach'], category: 'objects' },
  { emoji: '🔑', name: 'key', keywords: ['key', 'lock', 'password'], category: 'objects' },
  { emoji: '🔒', name: 'locked', keywords: ['lock', 'secure', 'private'], category: 'objects' },
  { emoji: '🔓', name: 'unlocked', keywords: ['unlock', 'open'], category: 'objects' },
  { emoji: '💰', name: 'money bag', keywords: ['money', 'rich', 'dollar'], category: 'objects' },
  { emoji: '💎', name: 'gem stone', keywords: ['diamond', 'gem', 'jewel'], category: 'objects' },
  { emoji: '🧲', name: 'magnet', keywords: ['magnet', 'attract'], category: 'objects' },
  { emoji: '⏰', name: 'alarm clock', keywords: ['alarm', 'clock', 'time', 'wake up'], category: 'objects' },
  { emoji: '🎈', name: 'balloon', keywords: ['balloon', 'party', 'birthday'], category: 'objects' },

  // ── Symbols ──
  { emoji: '❤️', name: 'red heart', keywords: ['love', 'heart', 'red'], category: 'symbols' },
  { emoji: '🧡', name: 'orange heart', keywords: ['love', 'heart', 'orange'], category: 'symbols' },
  { emoji: '💛', name: 'yellow heart', keywords: ['love', 'heart', 'yellow'], category: 'symbols' },
  { emoji: '💚', name: 'green heart', keywords: ['love', 'heart', 'green'], category: 'symbols' },
  { emoji: '💙', name: 'blue heart', keywords: ['love', 'heart', 'blue'], category: 'symbols' },
  { emoji: '💜', name: 'purple heart', keywords: ['love', 'heart', 'purple'], category: 'symbols' },
  { emoji: '🖤', name: 'black heart', keywords: ['love', 'heart', 'black'], category: 'symbols' },
  { emoji: '🤍', name: 'white heart', keywords: ['love', 'heart', 'white'], category: 'symbols' },
  { emoji: '💔', name: 'broken heart', keywords: ['heart', 'broken', 'sad'], category: 'symbols' },
  { emoji: '💯', name: 'hundred points', keywords: ['100', 'perfect', 'score'], category: 'symbols' },
  { emoji: '💢', name: 'anger symbol', keywords: ['angry', 'mad'], category: 'symbols' },
  { emoji: '💥', name: 'collision', keywords: ['boom', 'explosion', 'crash'], category: 'symbols' },
  { emoji: '💫', name: 'dizzy', keywords: ['star', 'dizzy', 'sparkle'], category: 'symbols' },
  { emoji: '💦', name: 'sweat droplets', keywords: ['sweat', 'water', 'splash'], category: 'symbols' },
  { emoji: '💨', name: 'dashing away', keywords: ['wind', 'fast', 'dash'], category: 'symbols' },
  { emoji: '✅', name: 'check mark button', keywords: ['check', 'done', 'yes', 'complete'], category: 'symbols' },
  { emoji: '❌', name: 'cross mark', keywords: ['no', 'wrong', 'cancel', 'delete'], category: 'symbols' },
  { emoji: '❓', name: 'question mark', keywords: ['question', 'what', 'ask'], category: 'symbols' },
  { emoji: '❗', name: 'exclamation mark', keywords: ['exclamation', 'important', 'alert'], category: 'symbols' },
  { emoji: '⚠️', name: 'warning', keywords: ['warning', 'caution', 'alert'], category: 'symbols' },
  { emoji: '🔴', name: 'red circle', keywords: ['red', 'circle', 'dot'], category: 'symbols' },
  { emoji: '🟢', name: 'green circle', keywords: ['green', 'circle', 'dot'], category: 'symbols' },
  { emoji: '🔵', name: 'blue circle', keywords: ['blue', 'circle', 'dot'], category: 'symbols' },
  { emoji: '⬆️', name: 'up arrow', keywords: ['up', 'arrow'], category: 'symbols' },
  { emoji: '⬇️', name: 'down arrow', keywords: ['down', 'arrow'], category: 'symbols' },
  { emoji: '➡️', name: 'right arrow', keywords: ['right', 'arrow', 'next'], category: 'symbols' },
  { emoji: '⬅️', name: 'left arrow', keywords: ['left', 'arrow', 'back'], category: 'symbols' },
  { emoji: '♻️', name: 'recycling symbol', keywords: ['recycle', 'environment', 'green'], category: 'symbols' },
  { emoji: '🏳️‍🌈', name: 'rainbow flag', keywords: ['pride', 'rainbow', 'lgbtq'], category: 'symbols' },
  { emoji: '🚩', name: 'triangular flag', keywords: ['flag', 'red flag', 'warning'], category: 'symbols' },

  // ── Flags ──
  { emoji: '🇺🇸', name: 'flag: United States', keywords: ['us', 'usa', 'america', 'flag'], category: 'flags' },
  { emoji: '🇬🇧', name: 'flag: United Kingdom', keywords: ['uk', 'britain', 'england', 'flag'], category: 'flags' },
  { emoji: '🇫🇷', name: 'flag: France', keywords: ['france', 'french', 'flag'], category: 'flags' },
  { emoji: '🇩🇪', name: 'flag: Germany', keywords: ['germany', 'german', 'flag'], category: 'flags' },
  { emoji: '🇪🇸', name: 'flag: Spain', keywords: ['spain', 'spanish', 'flag'], category: 'flags' },
  { emoji: '🇮🇹', name: 'flag: Italy', keywords: ['italy', 'italian', 'flag'], category: 'flags' },
  { emoji: '🇯🇵', name: 'flag: Japan', keywords: ['japan', 'japanese', 'flag'], category: 'flags' },
  { emoji: '🇰🇷', name: 'flag: South Korea', keywords: ['korea', 'korean', 'flag'], category: 'flags' },
  { emoji: '🇨🇳', name: 'flag: China', keywords: ['china', 'chinese', 'flag'], category: 'flags' },
  { emoji: '🇧🇷', name: 'flag: Brazil', keywords: ['brazil', 'brazilian', 'flag'], category: 'flags' },
  { emoji: '🇮🇳', name: 'flag: India', keywords: ['india', 'indian', 'flag'], category: 'flags' },
  { emoji: '🇷🇺', name: 'flag: Russia', keywords: ['russia', 'russian', 'flag'], category: 'flags' },
  { emoji: '🇦🇺', name: 'flag: Australia', keywords: ['australia', 'aussie', 'flag'], category: 'flags' },
  { emoji: '🇨🇦', name: 'flag: Canada', keywords: ['canada', 'canadian', 'flag'], category: 'flags' },
  { emoji: '🇲🇽', name: 'flag: Mexico', keywords: ['mexico', 'mexican', 'flag'], category: 'flags' },
  { emoji: '🇲🇰', name: 'flag: North Macedonia', keywords: ['macedonia', 'macedonian', 'flag'], category: 'flags' },
];

/** Get emojis for a single category */
export function getByCategory(categoryId: CategoryId): EmojiEntry[] {
  return EMOJIS.filter(e => e.category === categoryId);
}

/** Search emojis by query — matches name and keywords (case-insensitive substring) */
export function searchEmojis(query: string): EmojiEntry[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return EMOJIS.filter(e =>
    e.name.toLowerCase().includes(q) ||
    e.keywords.some(k => k.toLowerCase().includes(q))
  );
}

/** Load recently used emojis from localStorage */
export function loadRecentEmojis(userId: string): string[] {
  try {
    const raw = localStorage.getItem(`aero-emoji-recent:${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** Save an emoji to the recently used list (most recent first, max 16) */
export function saveRecentEmoji(userId: string, emoji: string): void {
  const recents = loadRecentEmojis(userId).filter(e => e !== emoji);
  recents.unshift(emoji);
  if (recents.length > 16) recents.length = 16;
  localStorage.setItem(`aero-emoji-recent:${userId}`, JSON.stringify(recents));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/emojiData.ts
git commit -m "feat: add emoji data module with categories, search, and recents"
```

---

### Task 2: Tenor API Client

**Files:**
- Create: `src/lib/tenor.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add Tenor API key to .env.example**

Append to `.env.example`:
```
# ── Tenor GIF API ──────────────────────────────────────────────────────
VITE_TENOR_API_KEY=your-tenor-api-key
```

- [ ] **Step 2: Create the Tenor client module**

Create `src/lib/tenor.ts`:

```ts
// src/lib/tenor.ts
const BASE = 'https://tenor.googleapis.com/v2';
const KEY = import.meta.env.VITE_TENOR_API_KEY ?? '';
const CLIENT_KEY = 'aero-chat';

export interface TenorGif {
  id: string;
  url: string;       // full animated GIF
  previewUrl: string; // tinygif static/small
  width: number;
  height: number;
}

interface TenorMediaFormat {
  url: string;
  dims: [number, number];
  size: number;
}

interface TenorResult {
  id: string;
  media_formats: Record<string, TenorMediaFormat>;
}

interface TenorResponse {
  results: TenorResult[];
  next: string;
}

function mapResults(results: TenorResult[]): TenorGif[] {
  return results
    .filter(r => r.media_formats?.gif && r.media_formats?.tinygif)
    .map(r => ({
      id: r.id,
      url: r.media_formats.gif.url,
      previewUrl: r.media_formats.tinygif.url,
      width: r.media_formats.gif.dims[0],
      height: r.media_formats.gif.dims[1],
    }));
}

export async function fetchTrending(limit = 20): Promise<TenorGif[]> {
  if (!KEY) return [];
  const params = new URLSearchParams({
    key: KEY, client_key: CLIENT_KEY,
    limit: String(limit),
    media_filter: 'gif,tinygif',
  });
  const res = await fetch(`${BASE}/featured?${params}`);
  if (!res.ok) throw new Error(`Tenor API error: ${res.status}`);
  const data: TenorResponse = await res.json();
  return mapResults(data.results);
}

export async function searchGifs(query: string, limit = 20): Promise<TenorGif[]> {
  if (!KEY || !query.trim()) return [];
  const params = new URLSearchParams({
    key: KEY, client_key: CLIENT_KEY, q: query.trim(),
    limit: String(limit),
    media_filter: 'gif,tinygif',
  });
  const res = await fetch(`${BASE}/search?${params}`);
  if (!res.ok) throw new Error(`Tenor API error: ${res.status}`);
  const data: TenorResponse = await res.json();
  return mapResults(data.results);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/tenor.ts .env.example
git commit -m "feat: add Tenor API client for GIF search and trending"
```

---

### Task 3: EmojiGifPicker Component

**Files:**
- Create: `src/components/ui/EmojiGifPicker.tsx`

- [ ] **Step 1: Create the picker component**

Create `src/components/ui/EmojiGifPicker.tsx`. This is a single popover with two tabs: Emoji and GIF. It portals to `document.body` and positions itself above + right-aligned to the trigger.

```tsx
// src/components/ui/EmojiGifPicker.tsx
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import {
  EMOJI_CATEGORIES, EMOJIS, getByCategory, searchEmojis,
  loadRecentEmojis, saveRecentEmoji,
  type CategoryId,
} from '../../lib/emojiData';
import { fetchTrending, searchGifs, type TenorGif } from '../../lib/tenor';

export interface EmojiGifPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onGifSelect: (gif: { url: string; width: number; height: number; previewUrl: string }) => void;
  userId: string;
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

export const EmojiGifPicker = memo(function EmojiGifPicker({
  onEmojiSelect, onGifSelect, userId, open, onClose, anchorRef,
}: EmojiGifPickerProps) {
  const [tab, setTab] = useState<'emoji' | 'gif'>('emoji');
  const [emojiSearch, setEmojiSearch] = useState('');
  const [gifSearch, setGifSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryId>('smileys');
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // GIF state
  const [gifs, setGifs] = useState<TenorGif[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState(false);
  const [trendingCache, setTrendingCache] = useState<TenorGif[] | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const gifSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recents
  const recents = useMemo(() => loadRecentEmojis(userId), [userId, open]);

  // Position calculation
  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    // Position above the input, right-aligned
    setPos({ x: rect.right - 340, y: rect.top - 8 });
  }, [open, anchorRef]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Delay to avoid the opening click triggering close
    const t = setTimeout(() => document.addEventListener('mousedown', handleClick), 50);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handleClick); };
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Load trending GIFs when GIF tab is opened
  useEffect(() => {
    if (!open || tab !== 'gif') return;
    if (gifSearch.trim()) return; // search is active, don't reload trending
    if (trendingCache) { setGifs(trendingCache); return; }
    setGifLoading(true);
    setGifError(false);
    fetchTrending()
      .then(results => { setGifs(results); setTrendingCache(results); })
      .catch(() => setGifError(true))
      .finally(() => setGifLoading(false));
  }, [open, tab, gifSearch, trendingCache]);

  // Debounced GIF search
  const handleGifSearchChange = useCallback((value: string) => {
    setGifSearch(value);
    if (gifSearchTimer.current) clearTimeout(gifSearchTimer.current);
    if (!value.trim()) {
      // Revert to trending
      if (trendingCache) setGifs(trendingCache);
      return;
    }
    gifSearchTimer.current = setTimeout(async () => {
      setGifLoading(true);
      setGifError(false);
      try {
        const results = await searchGifs(value);
        setGifs(results);
      } catch {
        setGifError(true);
      } finally {
        setGifLoading(false);
      }
    }, 300);
  }, [trendingCache]);

  const handleEmojiClick = useCallback((emoji: string) => {
    saveRecentEmoji(userId, emoji);
    onEmojiSelect(emoji);
  }, [userId, onEmojiSelect]);

  const handleGifClick = useCallback((gif: TenorGif) => {
    onGifSelect({ url: gif.url, width: gif.width, height: gif.height, previewUrl: gif.previewUrl });
    onClose();
  }, [onGifSelect, onClose]);

  // Emoji list to render
  const emojiList = useMemo(() => {
    if (emojiSearch.trim()) return searchEmojis(emojiSearch);
    return getByCategory(activeCategory);
  }, [emojiSearch, activeCategory]);

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: Math.max(8, pos.x),
        top: 'auto',
        bottom: window.innerHeight - pos.y,
        zIndex: 99980,
      }}
    >
      <div style={{
        width: 340, maxHeight: 420,
        borderRadius: 16, overflow: 'hidden',
        background: 'rgba(12,20,45,0.95)',
        border: '1px solid rgba(80,145,255,0.12)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.1)',
        backdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column',
        animation: 'profile-tooltip-fade 0.15s ease-out',
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(80,145,255,0.10)', flexShrink: 0 }}>
          <button
            onClick={() => setTab('emoji')}
            style={{
              flex: 1, padding: '10px 0', fontSize: 12, fontWeight: tab === 'emoji' ? 600 : 500,
              color: tab === 'emoji' ? '#00d4ff' : 'rgba(255,255,255,0.35)',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: tab === 'emoji' ? '2px solid #00d4ff' : '2px solid transparent',
            }}
          >
            😊 Emoji
          </button>
          <button
            onClick={() => setTab('gif')}
            style={{
              flex: 1, padding: '10px 0', fontSize: 12, fontWeight: tab === 'gif' ? 600 : 500,
              color: tab === 'gif' ? '#00d4ff' : 'rgba(255,255,255,0.35)',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: tab === 'gif' ? '2px solid #00d4ff' : '2px solid transparent',
            }}
          >
            GIF
          </button>
        </div>

        {tab === 'emoji' ? (
          <>
            {/* Search */}
            <div style={{ padding: '8px 10px', flexShrink: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                height: 32, borderRadius: 8, padding: '0 10px',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(80,145,255,0.10)',
              }}>
                <Search style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
                <input
                  value={emojiSearch}
                  onChange={e => setEmojiSearch(e.target.value)}
                  placeholder="Search emoji..."
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    color: 'rgba(255,255,255,0.85)', fontSize: 11,
                  }}
                />
                {emojiSearch && (
                  <button onClick={() => setEmojiSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex' }}>
                    <X style={{ width: 12, height: 12 }} />
                  </button>
                )}
              </div>
            </div>

            {/* Category bar — hidden when searching */}
            {!emojiSearch.trim() && (
              <div style={{ display: 'flex', gap: 2, padding: '0 10px 6px', overflowX: 'auto', flexShrink: 0 }}>
                {EMOJI_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    title={cat.label}
                    style={{
                      padding: '4px 8px', borderRadius: 6, fontSize: 13, flexShrink: 0,
                      background: activeCategory === cat.id ? 'rgba(0,212,255,0.12)' : 'transparent',
                      border: 'none', cursor: 'pointer',
                      opacity: activeCategory === cat.id ? 1 : 0.5,
                      transition: 'opacity 0.15s, background 0.15s',
                    }}
                  >
                    {cat.icon}
                  </button>
                ))}
              </div>
            )}

            {/* Category label */}
            {!emojiSearch.trim() && (
              <div style={{ padding: '2px 12px 4px', fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
                {emojiSearch.trim() ? 'Search Results' : EMOJI_CATEGORIES.find(c => c.id === activeCategory)?.label}
              </div>
            )}

            {/* Recents row */}
            {!emojiSearch.trim() && recents.length > 0 && activeCategory === 'smileys' && (
              <>
                <div style={{ padding: '2px 12px 2px', fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
                  Recently Used
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', padding: '0 8px 4px', flexShrink: 0 }}>
                  {recents.slice(0, 8).map((emoji, i) => (
                    <button
                      key={`recent-${i}`}
                      onClick={() => handleEmojiClick(emoji)}
                      style={{
                        width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20, borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer',
                        transition: 'background 0.1s, transform 0.1s',
                      }}
                      onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.target as HTMLElement).style.transform = 'scale(1.15)'; }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none'; (e.target as HTMLElement).style.transform = 'scale(1)'; }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div style={{ padding: '2px 12px 4px', fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
                  {EMOJI_CATEGORIES.find(c => c.id === activeCategory)?.label}
                </div>
              </>
            )}

            {/* Emoji grid */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)' }}>
                {(emojiSearch.trim() ? emojiList : emojiList).map((entry, i) => (
                  <button
                    key={`${entry.emoji}-${i}`}
                    onClick={() => handleEmojiClick(entry.emoji)}
                    title={entry.name}
                    style={{
                      width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20, borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer',
                      transition: 'background 0.1s, transform 0.1s',
                    }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.target as HTMLElement).style.transform = 'scale(1.15)'; }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none'; (e.target as HTMLElement).style.transform = 'scale(1)'; }}
                  >
                    {entry.emoji}
                  </button>
                ))}
              </div>
              {emojiSearch.trim() && emojiList.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                  No emojis found
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* GIF Search */}
            <div style={{ padding: '8px 10px', flexShrink: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                height: 32, borderRadius: 8, padding: '0 10px',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(80,145,255,0.10)',
              }}>
                <Search style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
                <input
                  value={gifSearch}
                  onChange={e => handleGifSearchChange(e.target.value)}
                  placeholder="Search Tenor..."
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    color: 'rgba(255,255,255,0.85)', fontSize: 11,
                  }}
                />
                {gifSearch && (
                  <button onClick={() => handleGifSearchChange('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex' }}>
                    <X style={{ width: 12, height: 12 }} />
                  </button>
                )}
              </div>
            </div>

            {/* Label */}
            <div style={{ padding: '2px 12px 6px', fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
              {gifSearch.trim() ? 'Results' : 'Trending'}
            </div>

            {/* GIF grid */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 4px' }}>
              {gifLoading && gifs.length === 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} style={{
                      height: 70 + (i % 3) * 20, borderRadius: 8,
                      background: 'rgba(255,255,255,0.04)',
                      animation: 'profile-tooltip-fade 0.6s ease-in-out infinite alternate',
                    }} />
                  ))}
                </div>
              ) : gifError ? (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>Couldn't load GIFs</p>
                  <button
                    onClick={() => {
                      setGifError(false);
                      setTrendingCache(null);
                      setGifSearch('');
                    }}
                    style={{
                      fontSize: 11, color: '#00d4ff', background: 'rgba(0,212,255,0.12)',
                      border: '1px solid rgba(0,212,255,0.25)', borderRadius: 8, padding: '4px 12px', cursor: 'pointer',
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {gifs.map(gif => (
                    <button
                      key={gif.id}
                      onClick={() => handleGifClick(gif)}
                      style={{
                        border: 'none', padding: 0, cursor: 'pointer', background: 'none',
                        borderRadius: 8, overflow: 'hidden',
                        transition: 'transform 0.15s, box-shadow 0.15s',
                      }}
                      onMouseEnter={e => { (e.target as HTMLElement).style.transform = 'scale(1.03)'; (e.target as HTMLElement).style.boxShadow = '0 0 12px rgba(0,212,255,0.2)'; }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.transform = 'scale(1)'; (e.target as HTMLElement).style.boxShadow = 'none'; }}
                    >
                      <img
                        src={gif.previewUrl}
                        alt=""
                        loading="lazy"
                        style={{
                          width: '100%', display: 'block',
                          borderRadius: 8,
                          aspectRatio: `${gif.width} / ${gif.height}`,
                          objectFit: 'cover',
                          background: 'rgba(255,255,255,0.04)',
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}
              {!gifLoading && !gifError && gifs.length === 0 && gifSearch.trim() && (
                <div style={{ textAlign: 'center', padding: '30px 0', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                  No GIFs found
                </div>
              )}
            </div>

            {/* Tenor attribution */}
            <div style={{ padding: '4px 12px 8px', fontSize: 9, color: 'rgba(255,255,255,0.2)', textAlign: 'right', flexShrink: 0 }}>
              Powered by Tenor
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/EmojiGifPicker.tsx
git commit -m "feat: add EmojiGifPicker component with emoji grid and Tenor GIF search"
```

---

### Task 4: Integrate Picker into ChatWindow (DMs)

**Files:**
- Modify: `src/components/chat/ChatWindow.tsx`

This task adds four things to ChatWindow:
1. `isGifMessage` helper (alongside existing `isVoiceMessage`, etc.)
2. Smiley trigger button inside the input field
3. Emoji insert handler that appends to the input state
4. GIF send handler that calls `sendEncryptedContent`
5. GIF message rendering in the message chain

- [ ] **Step 1: Add `isGifMessage` helper**

After the existing `isCalendarInvite` function (~line 60), add:

```ts
function isGifMessage(content: string): boolean {
  try { return JSON.parse(content)._gif === true; } catch { return false; }
}

function parseGifMessage(content: string): { url: string; width: number; height: number; previewUrl: string } | null {
  try {
    const p = JSON.parse(content);
    if (p._gif) return { url: p.url, width: p.width, height: p.height, previewUrl: p.previewUrl };
    return null;
  } catch { return null; }
}
```

- [ ] **Step 2: Add import for the picker**

Add to imports at top of file:

```ts
import { EmojiGifPicker } from '../ui/EmojiGifPicker';
```

Also add `Smile` to the lucide-react import.

- [ ] **Step 3: Add picker state and refs inside the ChatWindow component**

Inside the component, alongside existing state variables, add:

```ts
const [pickerOpen, setPickerOpen] = useState(false);
const pickerAnchorRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 4: Add emoji insert and GIF send handlers**

```ts
const handleEmojiSelect = useCallback((emoji: string) => {
  setInput(prev => prev + emoji);
  inputRef.current?.focus();
}, []);

const handleGifSelect = useCallback(async (gif: { url: string; width: number; height: number; previewUrl: string }) => {
  await sendEncryptedContent(JSON.stringify({ _gif: true, ...gif }));
}, []);
```

- [ ] **Step 5: Add smiley trigger button inside the input wrapper**

In the input bar JSX (the non-recording branch), wrap the `<input>` in a container div and add the smiley button inside it. Change:

```tsx
<input
  ref={inputRef}
  className="aero-input flex-1 py-2.5 text-sm"
  placeholder={`Message ${contact.username}…`}
  ...
/>
```

To:

```tsx
<div ref={pickerAnchorRef} className="aero-input flex-1 flex items-center" style={{ padding: 0 }}>
  <input
    ref={inputRef}
    className="flex-1 bg-transparent py-2.5 px-3 text-sm outline-none"
    style={{ color: 'var(--text-primary)' }}
    placeholder={`Message ${contact.username}…`}
    value={input}
    onChange={handleInputChange}
    onPaste={handlePaste}
    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); } }}
    disabled={!hasPrivateKey}
  />
  <button
    type="button"
    onClick={() => setPickerOpen(p => !p)}
    disabled={!hasPrivateKey}
    className="flex items-center justify-center rounded-lg transition-all hover:scale-110 disabled:opacity-40"
    style={{ width: 28, height: 28, marginRight: 6, background: 'rgba(0,212,255,0.10)', border: '1px solid rgba(0,212,255,0.20)', flexShrink: 0 }}
    title="Emoji & GIF"
  >
    <Smile className="h-4 w-4" style={{ color: '#00d4ff' }} />
  </button>
</div>
```

- [ ] **Step 6: Render the picker component**

Just before the closing `</form>` tag, add:

```tsx
<EmojiGifPicker
  open={pickerOpen}
  onClose={() => setPickerOpen(false)}
  onEmojiSelect={handleEmojiSelect}
  onGifSelect={handleGifSelect}
  userId={user?.id ?? ''}
  anchorRef={pickerAnchorRef}
/>
```

- [ ] **Step 7: Add GIF message rendering**

In the message rendering chain, before the final `isVoiceMessage` check (the ternary chain that renders different message types), add a GIF check. Right before the `isVoiceMessage(msg.content)` branch, insert:

```tsx
isGifMessage(msg.content) ? (() => {
  const gif = parseGifMessage(msg.content);
  if (!gif) return null;
  return (
    <div style={{ position: 'relative', maxWidth: 280, borderRadius: 12, overflow: 'hidden' }}>
      <img
        src={gif.url}
        alt="GIF"
        loading="lazy"
        style={{
          width: '100%', display: 'block',
          aspectRatio: `${gif.width} / ${gif.height}`,
          objectFit: 'cover',
          background: 'rgba(255,255,255,0.04)',
        }}
      />
      <div style={{
        position: 'absolute', top: 6, left: 6,
        padding: '2px 6px', borderRadius: 4,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.7)',
        letterSpacing: '0.05em',
      }}>
        GIF
      </div>
    </div>
  );
})() :
```

This goes before the `isVoiceMessage` branch so the ternary chain becomes:
`isCallMessage → isCalendarInvite → isServerInvite → isGifMessage → isVoiceMessage → isFileMessage → ...`

- [ ] **Step 8: Commit**

```bash
git add src/components/chat/ChatWindow.tsx
git commit -m "feat: integrate emoji/GIF picker into DM ChatWindow"
```

---

### Task 5: Integrate Picker into BubbleChat (Servers)

**Files:**
- Modify: `src/components/servers/BubbleChat.tsx`

Same pattern as ChatWindow but using `sendContent` (unencrypted) instead of `sendEncryptedContent`.

- [ ] **Step 1: Add `isGifMessage` helper**

After the existing `isFileMessage` helper (~line 28), add:

```ts
function isGifMessage(content: string): boolean {
  try { return JSON.parse(content)._gif === true; } catch { return false; }
}

function parseGifMessage(content: string): { url: string; width: number; height: number; previewUrl: string } | null {
  try {
    const p = JSON.parse(content);
    if (p._gif) return { url: p.url, width: p.width, height: p.height, previewUrl: p.previewUrl };
    return null;
  } catch { return null; }
}
```

- [ ] **Step 2: Add import**

Add to imports:
```ts
import { EmojiGifPicker } from '../ui/EmojiGifPicker';
import { Smile } from 'lucide-react';
```

Add `Smile` to the existing lucide-react import line if present.

- [ ] **Step 3: Add picker state in the BubbleChat component**

```ts
const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
const pickerAnchorRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 4: Add handlers**

```ts
const handleEmojiSelect = useCallback((emoji: string) => {
  setInput(prev => prev + emoji);
  inputRef.current?.focus();
}, []);

const handleGifSelect = useCallback(async (gif: { url: string; width: number; height: number; previewUrl: string }) => {
  await sendContent(JSON.stringify({ _gif: true, ...gif }));
}, []);
```

- [ ] **Step 5: Add smiley button to input bar**

The BubbleChat input bar currently looks like:
```tsx
<div className="flex items-center gap-2 rounded-aero-lg px-3" style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}>
  <input ref={inputRef} ... />
  <button ... ><Paperclip /></button>
  <button ... ><Mic /></button>
  <button ... ><Send /></button>
</div>
```

Add the smiley button and `ref` to the wrapper. Wrap the existing content: change the outer `div` to include `ref={pickerAnchorRef}`, and add the smiley button right after `<input>` and before `<Paperclip>`:

```tsx
<div
  ref={pickerAnchorRef}
  className="flex items-center gap-2 rounded-aero-lg px-3"
  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}
>
  <input ref={inputRef} ... />
  <button
    onClick={() => setEmojiPickerOpen(p => !p)}
    className="transition-opacity hover:opacity-70"
    style={{ color: 'var(--text-muted)' }}
    title="Emoji & GIF"
  >
    <Smile className="h-4 w-4" />
  </button>
  {/* existing Paperclip, Mic, Send buttons */}
</div>
```

- [ ] **Step 6: Render the picker**

Before the closing `</div>` of the main component return (after the ExternalLinkModal), add:

```tsx
<EmojiGifPicker
  open={emojiPickerOpen}
  onClose={() => setEmojiPickerOpen(false)}
  onEmojiSelect={handleEmojiSelect}
  onGifSelect={handleGifSelect}
  userId={user?.id ?? ''}
  anchorRef={pickerAnchorRef}
/>
```

- [ ] **Step 7: Add GIF rendering in BubbleMessageItem**

In the message content rendering inside `BubbleMessageItem`, the chain is currently:
```tsx
{isVoice ? <VoicePlayer ... /> : isFile ? <BubbleFileMessage ... /> : renderMentionContent(...)}
```

Add GIF check before voice:
```tsx
const isGif = isGifMessage(msg.content);
```

Then update the rendering chain:
```tsx
{isGif ? (() => {
  const gif = parseGifMessage(msg.content);
  if (!gif) return null;
  return (
    <div style={{ position: 'relative', maxWidth: 280, borderRadius: 12, overflow: 'hidden' }}>
      <img src={gif.url} alt="GIF" loading="lazy" style={{
        width: '100%', display: 'block',
        aspectRatio: `${gif.width} / ${gif.height}`,
        objectFit: 'cover', background: 'rgba(255,255,255,0.04)',
      }} />
      <div style={{
        position: 'absolute', top: 6, left: 6,
        padding: '2px 6px', borderRadius: 4,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.7)',
        letterSpacing: '0.05em',
      }}>
        GIF
      </div>
    </div>
  );
})() : isVoice ? (
  <VoicePlayer ... />
) : isFile ? (
  <BubbleFileMessage ... />
) : (
  renderMentionContent(...)
)}
```

- [ ] **Step 8: Commit**

```bash
git add src/components/servers/BubbleChat.tsx
git commit -m "feat: integrate emoji/GIF picker into server BubbleChat"
```

---

### Task 6: Build, Test, and Deploy

- [ ] **Step 1: Add Tenor API key to .env**

Add the actual Tenor API key to the local `.env` file:
```
VITE_TENOR_API_KEY=<actual-key>
```

The user needs to get a key from [Google Cloud Console → APIs → Tenor API v2](https://console.cloud.google.com/apis/library/tenor.googleapis.com).

- [ ] **Step 2: Run build**

```bash
cd aero-chat-app && pnpm build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Test locally**

```bash
cd aero-chat-app && pnpm dev
```

Manual verification:
1. Open DM chat → click smiley in input → emoji tab shows categories and grid → click emoji inserts into input
2. Switch to GIF tab → trending GIFs load → type search → results update after 300ms → click GIF sends message
3. Sent GIF renders inline with "GIF" badge, max-width 280px
4. Open server bubble chat → same smiley button → same emoji/GIF flow works
5. Recently used emojis show at top of emoji tab
6. Picker closes on Escape or outside click

- [ ] **Step 4: Add VITE_TENOR_API_KEY to Vercel env vars**

```bash
vercel env add VITE_TENOR_API_KEY production
```

- [ ] **Step 5: Deploy**

```bash
cd aero-chat-app && vercel --prod --yes
```

- [ ] **Step 6: Final commit with all changes**

```bash
git add -A && git push origin main
```
