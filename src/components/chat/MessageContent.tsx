import { LinkPreview } from './LinkPreview';

const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;

interface Props {
  content: string;
  isMine: boolean;
  textColor: string;
  onClickLink: (url: string) => void;
}

export function MessageContent({ content, isMine, textColor, onClickLink }: Props) {
  // Split content into alternating [text, url, text, url, ...] segments
  const parts = content.split(URL_REGEX);
  const urls = content.match(URL_REGEX) ?? [];

  // Collect unique URLs (cap at 1 preview to avoid wall of cards)
  const previewUrls = [...new Set(urls)].slice(0, 1);

  const hasOnlyUrl = parts.length === 3 && parts[0].trim() === '' && parts[2].trim() === '';

  return (
    <div>
      {/* Inline text with clickable link spans */}
      {!hasOnlyUrl && (
        <p
          className="text-sm leading-relaxed break-words"
          style={{ color: textColor, fontFamily: 'Inter, system-ui, sans-serif' }}
        >
          {parts.map((part, i) => {
            if (URL_REGEX.test(part)) {
              // Reset lastIndex since we reuse the regex
              URL_REGEX.lastIndex = 0;
              return (
                <button
                  key={i}
                  onClick={() => onClickLink(part)}
                  className="underline underline-offset-2 break-all transition-opacity hover:opacity-70"
                  style={{
                    color: isMine ? 'rgba(255,255,255,0.90)' : '#1a78a8',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    lineHeight: 'inherit',
                    verticalAlign: 'baseline',
                    cursor: 'pointer',
                  }}
                >
                  {part}
                </button>
              );
            }
            URL_REGEX.lastIndex = 0;
            return part ? <span key={i}>{part}</span> : null;
          })}
        </p>
      )}

      {/* When message is only a bare URL, show it as a styled link pill instead of text */}
      {hasOnlyUrl && urls[0] != null && (
        <button
          onClick={() => onClickLink(urls[0]!)}
          className="text-sm underline underline-offset-2 break-all hover:opacity-70 transition-opacity text-left"
          style={{ color: isMine ? 'rgba(255,255,255,0.90)' : '#1a78a8', fontFamily: 'Inter, system-ui, sans-serif' }}
        >
          {urls[0]}
        </button>
      )}

      {/* Preview cards */}
      {previewUrls.map(url => (
        <LinkPreview key={url} url={url} isMine={isMine} onClickLink={onClickLink} />
      ))}
    </div>
  );
}
