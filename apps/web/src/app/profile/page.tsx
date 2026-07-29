'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Skill, User } from '@/lib/types';
import { AppHeader } from '@/components/AppHeader';

export default function ProfilePage() {
  const [form, setForm] = useState({
    displayName: '',
    bio: '',
    country: '',
    city: '',
    githubUrl: '',
    websiteUrl: '',
  });
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api<User>('/users/me'), api<Skill[]>('/skills')])
      .then(([user, skills]) => {
        setAllSkills(skills);
        setForm({
          displayName: user.profile?.displayName ?? '',
          bio: user.profile?.bio ?? '',
          country: user.profile?.country ?? '',
          city: user.profile?.city ?? '',
          githubUrl: user.profile?.githubUrl ?? '',
          websiteUrl: user.profile?.websiteUrl ?? '',
        });
        setSelectedSkillIds((user.profile?.skills ?? []).map((s) => s.skill.id));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить профиль'))
      .finally(() => setLoading(false));
  }, []);

  function toggleSkill(skillId: string) {
    setSelectedSkillIds((current) =>
      current.includes(skillId) ? current.filter((id) => id !== skillId) : [...current, skillId],
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api('/users/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: form.displayName,
          bio: form.bio || undefined,
          country: form.country || undefined,
          city: form.city || undefined,
          githubUrl: form.githubUrl || undefined,
          websiteUrl: form.websiteUrl || undefined,
          skillIds: selectedSkillIds,
        }),
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить профиль');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-2xl px-4 py-10 text-stone-500">Загружаем профиль…</main>;
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <AppHeader />
      <h1 className="mb-6 font-serif text-2xl text-stone-900">Профиль</h1>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-600">Имя</label>
          <input
            required
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            className="w-full rounded-lg border border-stone-300 px-4 py-3"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-stone-600">О себе</label>
          <textarea
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            className="min-h-28 w-full rounded-lg border border-stone-300 px-4 py-3"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-600">Страна</label>
            <input
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              className="w-full rounded-lg border border-stone-300 px-4 py-3"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-600">Город</label>
            <input
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              className="w-full rounded-lg border border-stone-300 px-4 py-3"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-stone-600">GitHub</label>
          <input
            type="url"
            placeholder="https://github.com/username"
            value={form.githubUrl}
            onChange={(e) => setForm((f) => ({ ...f, githubUrl: e.target.value }))}
            className="w-full rounded-lg border border-stone-300 px-4 py-3"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-stone-600">Сайт/портфолио</label>
          <input
            type="url"
            placeholder="https://..."
            value={form.websiteUrl}
            onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
            className="w-full rounded-lg border border-stone-300 px-4 py-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-stone-600">Навыки</label>
          <div className="flex flex-wrap gap-2">
            {allSkills.map((skill) => {
              const selected = selectedSkillIds.includes(skill.id);
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => toggleSkill(skill.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    selected ? 'border-brand bg-brand/10 text-brand' : 'border-stone-300 text-stone-600 hover:border-stone-400'
                  }`}
                >
                  {skill.name}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-emerald-600">Профиль сохранён.</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand px-6 py-3 font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </form>
    </main>
  );
}
