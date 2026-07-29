'use client';

import { useEffect, useRef, useState } from 'react';
import { api, API_URL, createSkill, uploadAvatar } from '@/lib/api';
import type { Skill, User } from '@/lib/types';
import { AppHeader } from '@/components/AppHeader';

const MAX_SKILLS = 25;

export default function ProfilePage() {
  const [form, setForm] = useState({
    displayName: '',
    bio: '',
    country: '',
    city: '',
    githubUrl: '',
    websiteUrl: '',
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [skillCreating, setSkillCreating] = useState(false);
  const [skillError, setSkillError] = useState<string | null>(null);

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
        setAvatarUrl(user.profile?.avatarUrl ?? null);
        setSelectedSkillIds((user.profile?.skills ?? []).map((s) => s.skill.id));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить профиль'))
      .finally(() => setLoading(false));
  }, []);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError('Нужен файл изображения (JPEG, PNG, GIF, WEBP)');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Файл больше 2MB');
      return;
    }

    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const result = await uploadAvatar(file);
      setAvatarUrl(`${result.avatarUrl}?t=${Date.now()}`);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Не удалось загрузить фото');
    } finally {
      setAvatarUploading(false);
    }
  }

  async function addSkillByName(rawName: string) {
    const name = rawName.trim();
    if (!name) return;
    if (selectedSkillIds.length >= MAX_SKILLS) {
      setSkillError(`Максимум ${MAX_SKILLS} навыков`);
      return;
    }

    const existingByName = allSkills.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (existingByName) {
      setSkillInput('');
      setSkillError(null);
      if (!selectedSkillIds.includes(existingByName.id)) {
        setSelectedSkillIds((ids) => [...ids, existingByName.id]);
      }
      return;
    }

    setSkillCreating(true);
    setSkillError(null);
    try {
      const skill = await createSkill(name);
      setAllSkills((current) => (current.some((s) => s.id === skill.id) ? current : [...current, skill]));
      setSelectedSkillIds((ids) => (ids.includes(skill.id) ? ids : [...ids, skill.id]));
      setSkillInput('');
    } catch (err) {
      setSkillError(err instanceof Error ? err.message : 'Не удалось добавить навык');
    } finally {
      setSkillCreating(false);
    }
  }

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

      <div className="mb-6 flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={avatarUploading}
          className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card-sand font-serif text-2xl text-stone-900 transition hover:opacity-90 disabled:opacity-60"
          title="Загрузить фото"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${API_URL}${avatarUrl}`} alt="Аватар" className="h-full w-full object-cover" />
          ) : (
            form.displayName.charAt(0).toUpperCase() || '?'
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
            {avatarUploading ? '…' : 'Изменить'}
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleAvatarChange}
          className="hidden"
        />
        <div>
          <p className="font-serif text-lg text-stone-900">{form.displayName || 'Без имени'}</p>
          <p className="text-sm text-stone-500">{[form.city, form.country].filter(Boolean).join(', ') || 'Локация не указана'}</p>
          {avatarError && <p className="mt-1 text-xs text-red-600">{avatarError}</p>}
        </div>
      </div>

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
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-medium text-stone-600">Навыки</label>
            <span className="text-xs text-stone-400">
              {selectedSkillIds.length}/{MAX_SKILLS}
            </span>
          </div>
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

          <div className="mt-3">
            <input
              placeholder="Своего навыка нет в списке? Впишите и нажмите Enter"
              value={skillInput}
              disabled={skillCreating}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                addSkillByName(skillInput);
              }}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm disabled:opacity-60"
            />
            {skillError && <p className="mt-1 text-xs text-red-600">{skillError}</p>}
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
