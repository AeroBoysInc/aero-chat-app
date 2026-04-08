import { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { AvatarImage } from '../ui/AvatarImage';

export function AvatarUpload() {
  const { user, refreshProfile } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setError('');
    setUploading(true);

    const isGif = file.type === 'image/gif';
    const isPremium = user.is_premium === true;

    try {
      if (isGif && isPremium) {
        // ── Premium GIF: upload animated + generate static first frame ──
        if (file.size > 2 * 1024 * 1024) {
          setError('GIF must be under 2MB');
          setUploading(false);
          return;
        }

        // Upload original GIF
        const gifPath = `${user.id}/${Date.now()}-animated.gif`;
        const { error: gifErr } = await supabase.storage.from('avatars').upload(gifPath, file, { upsert: true, contentType: 'image/gif' });
        if (gifErr) { setError(gifErr.message); setUploading(false); return; }
        const { data: { publicUrl: gifUrl } } = supabase.storage.from('avatars').getPublicUrl(gifPath);

        // Generate static first frame
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d')!;
        const size = Math.min(bitmap.width, bitmap.height);
        const ox = (bitmap.width - size) / 2;
        const oy = (bitmap.height - size) / 2;
        ctx.drawImage(bitmap, ox, oy, size, size, 0, 0, 256, 256);
        const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/webp', 0.8));

        setPreview(URL.createObjectURL(blob));

        const staticPath = `${user.id}/${Date.now()}.webp`;
        const { error: staticErr } = await supabase.storage.from('avatars').upload(staticPath, blob, { upsert: true });
        if (staticErr) { setError(staticErr.message); setUploading(false); return; }
        const { data: { publicUrl: staticUrl } } = supabase.storage.from('avatars').getPublicUrl(staticPath);

        // Save both URLs
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({ avatar_url: staticUrl, avatar_gif_url: gifUrl })
          .eq('id', user.id);
        if (updateErr) { setError(updateErr.message); setUploading(false); return; }
      } else {
        // ── Static image (or GIF for free user — strip animation) ──
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d')!;
        const size = Math.min(bitmap.width, bitmap.height);
        const ox = (bitmap.width - size) / 2;
        const oy = (bitmap.height - size) / 2;
        ctx.drawImage(bitmap, ox, oy, size, size, 0, 0, 256, 256);
        const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/webp', 0.8));

        setPreview(URL.createObjectURL(blob));

        const path = `${user.id}/${Date.now()}.webp`;
        const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true });
        if (uploadErr) { setError(uploadErr.message); setUploading(false); return; }
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);

        // Clear gif url if switching from GIF to static
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl, avatar_gif_url: null })
          .eq('id', user.id);
        if (updateErr) { setError(updateErr.message); setUploading(false); return; }
      }

      await refreshProfile();
    } catch (err: any) {
      setError(err.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="group relative cursor-pointer"
        aria-label="Change avatar"
      >
        <div className="h-20 w-20 overflow-hidden rounded-full ring-2 ring-white/20 ring-offset-2 ring-offset-transparent">
          {preview ? (
            <img src={preview} alt="avatar preview" className="h-full w-full object-cover" />
          ) : (
            <AvatarImage username={user?.username ?? '?'} avatarUrl={user?.avatar_url} size="lg" />
          )}
        </div>
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          {uploading ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
        </div>
      </button>
      <p className="text-xs text-white/40">Click to change avatar{user?.is_premium ? ' (GIF supported)' : ''}</p>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
