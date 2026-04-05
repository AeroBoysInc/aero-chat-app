import { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useWriterStore } from '../../store/writerStore';
import { WriterOnboarding } from './writers/WriterOnboarding';
import { WriterHub } from './writers/WriterHub';
import { StoryReader } from './writers/StoryReader';
import { StoryEditor } from './writers/StoryEditor';
import { WriterApplication } from './writers/WriterApplication';
import { AdminPanel } from './writers/AdminPanel';

export function WritersCorner() {
  const user = useAuthStore(s => s.user);
  const { role, onboardingSeen, view, initRole, markOnboardingSeen, fetchPublicStories, fetchLikedIds } =
    useWriterStore();

  useEffect(() => {
    if (!user) return;
    initRole(user.id, user.username);
    fetchPublicStories();
    fetchLikedIds(user.id);
  }, [user?.id]);

  if (!user || role === null) {
    return (
      <div
        className="flex h-full items-center justify-center"
        style={{ color: 'rgba(168,85,247,0.7)', fontSize: 13 }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div
      className="flex h-full flex-col"
      style={{
        background: 'var(--sidebar-bg)',
        overflow: 'hidden',
      }}
    >
      {!onboardingSeen && (
        <WriterOnboarding onClose={() => markOnboardingSeen(user.id)} />
      )}

      {view === 'hub' && <WriterHub />}
      {view === 'reader' && <StoryReader />}
      {view === 'editor' && <StoryEditor />}
      {view === 'application' && <WriterApplication />}
      {view === 'admin' && <AdminPanel />}
    </div>
  );
}
