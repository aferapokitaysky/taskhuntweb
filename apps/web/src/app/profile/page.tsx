'use client';

import { useEffect, useRef, useState } from 'react';
import { api, API_URL, createSkill, uploadAvatar } from '@/lib/api';
import type { PortfolioItem, Skill, User } from '@/lib/types';
import { AppHeader } from '@/components/AppHeader';

const MAX_SKILLS = 25;

const EMPTY_PORTFOLIO_FORM = { title: '', description: '', imageUrl: '', projectUrl: '', tags: [] as string[] };

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

  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [showPortfolioForm, setShowPortfolioForm] = useState(false);
  const [editingPortfolioId, setEditingPortfolioId] = useState<string | null>(null);
  const [portfolioForm, setPortfolioForm] = useState(EMPTY_PORTFOLIO_FORM);
  const [portfolioTagInput, setPortfolioTagInput] = useState('');
  const [portfolioSaving, setPortfolioSaving] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', repeatPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

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
        setPortfolioItems(user.profile?.portfolioItems ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить профиль'))
      .finally(() => setLoading(false));
  }, []);

  function startAddPortfolio() {
    setEditingPortfolioId(null);
    setPortfolioForm(EMPTY_PORTFOLIO_FORM);
    setPortfolioError(null);
    setShowPortfolioForm(true);
  }

  function startEditPortfolio(item: PortfolioItem) {
    setEditingPortfolioId(item.id);
    setPortfolioForm({
      title: item.title,
      description: item.description ?? '',
      imageUrl: item.imageUrl ?? '',
      projectUrl: item.projectUrl ?? '',
      tags: item.tags,
    });
    setPortfolioError(null);
    setShowPortfolioForm(true);
  }

  async function submitPortfolio(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPortfolioSaving(true);
    setPortfolioError(null);
    const payload = {
      title: portfolioForm.title,
      description: portfolioForm.description || undefined,
      imageUrl: portfolioForm.imageUrl || undefined,
      projectUrl: portfolioForm.projectUrl || undefined,
      tags: portfolioForm.tags,
    };
    try {
      if (editingPortfolioId) {
        const updated = await api<PortfolioItem>(`/users/me/portfolio/${editingPortfolioId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setPortfolioItems((current) => current.map((i) => (i.id === editingPortfolioId ? updated : i)));
      } else {
        const created = await api<PortfolioItem>('/users/me/portfolio', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setPortfolioItems((current) => [created, ...current]);
      }
      setShowPortfolioForm(false);
      setPortfolioForm(EMPTY_PORTFOLIO_FORM);
      setEditingPortfolioId(null);
    } catch (err) {
      setPortfolioError(err instanceof Error ? err.message : 'Не удалось сохранить кейс');
    } finally {
      setPortfolioSaving(false);
    }
  }

  async function deletePortfolio(id: string) {
    setPortfolioItems((current) => current.filter((i) => i.id !== id));
    await api(`/users/me/portfolio/${id}`, { method: 'DELETE' }).catch(() => undefined);
  }

  async function submitPasswordChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);
    if (passwordForm.newPassword !== passwordForm.repeatPassword) {
      setPasswordError('Новый пароль и повтор не совпадают');
      return;
    }
    setPasswordSaving(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      setPasswordSaved(true);
      setPasswordForm({ currentPassword: '', newPassword: '', repeatPassword: '' });
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Не удалось сменить пароль');
    } finally {
      setPasswordSaving(false);
    }
  }

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

      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl text-stone-900">Портфолио</h2>
          {!showPortfolioForm && (
            <button
              type="button"
              onClick={startAddPortfolio}
              className="rounded-full border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:border-brand hover:text-brand"
            >
              + Добавить кейс
            </button>
          )}
        </div>

        {portfolioItems.length > 0 && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            {portfolioItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-stone-100 p-4">
                {item.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt={item.title} className="mb-3 h-32 w-full rounded-lg object-cover" />
                )}
                <p className="font-medium text-stone-900">{item.title}</p>
                {item.description && <p className="mt-1 line-clamp-2 text-sm text-stone-600">{item.description}</p>}
                {item.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-card-sand px-2 py-0.5 text-xs text-stone-700">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-3 text-sm">
                  {item.projectUrl && (
                    <a href={item.projectUrl} target="_blank" rel="noreferrer" className="font-medium text-brand hover:text-brand-dark">
                      Смотреть проект →
                    </a>
                  )}
                  <button type="button" onClick={() => startEditPortfolio(item)} className="text-stone-500 hover:text-stone-700">
                    Изменить
                  </button>
                  <button type="button" onClick={() => deletePortfolio(item.id)} className="text-stone-400 hover:text-red-600">
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {portfolioItems.length === 0 && !showPortfolioForm && (
          <p className="text-sm text-stone-400">Пока пусто — добавьте первый кейс, чтобы показать примеры работ клиентам.</p>
        )}

        {showPortfolioForm && (
          <form onSubmit={submitPortfolio} className="space-y-3 rounded-2xl border border-stone-100 p-4">
            <input
              required
              placeholder="Название кейса"
              value={portfolioForm.title}
              onChange={(e) => setPortfolioForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
            <textarea
              placeholder="Описание"
              value={portfolioForm.description}
              onChange={(e) => setPortfolioForm((f) => ({ ...f, description: e.target.value }))}
              className="min-h-20 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="Ссылка на картинку (необязательно)"
              value={portfolioForm.imageUrl}
              onChange={(e) => setPortfolioForm((f) => ({ ...f, imageUrl: e.target.value }))}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="Ссылка на проект (необязательно)"
              value={portfolioForm.projectUrl}
              onChange={(e) => setPortfolioForm((f) => ({ ...f, projectUrl: e.target.value }))}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
            <div>
              <input
                placeholder="Тэги — Enter добавляет"
                value={portfolioTagInput}
                onChange={(e) => setPortfolioTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || !portfolioTagInput.trim()) return;
                  e.preventDefault();
                  const tag = portfolioTagInput.trim();
                  if (!portfolioForm.tags.includes(tag)) {
                    setPortfolioForm((f) => ({ ...f, tags: [...f.tags, tag] }));
                  }
                  setPortfolioTagInput('');
                }}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              />
              {portfolioForm.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {portfolioForm.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setPortfolioForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }))}
                      className="rounded-full bg-card-sand px-2.5 py-1 text-xs font-medium text-stone-700 hover:line-through"
                    >
                      {tag} ×
                    </button>
                  ))}
                </div>
              )}
            </div>

            {portfolioError && <p className="text-sm text-red-600">{portfolioError}</p>}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={portfolioSaving}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {portfolioSaving ? 'Сохраняем…' : editingPortfolioId ? 'Сохранить изменения' : 'Добавить'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPortfolioForm(false);
                  setEditingPortfolioId(null);
                }}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600"
              >
                Отмена
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-serif text-xl text-stone-900">Безопасность</h2>
        <form onSubmit={submitPasswordChange} className="max-w-sm space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-600">Текущий пароль</label>
            <input
              required
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
              className="w-full rounded-lg border border-stone-300 px-4 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-600">Новый пароль</label>
            <input
              required
              minLength={8}
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
              className="w-full rounded-lg border border-stone-300 px-4 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-600">Повторите новый пароль</label>
            <input
              required
              minLength={8}
              type="password"
              value={passwordForm.repeatPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, repeatPassword: e.target.value }))}
              className="w-full rounded-lg border border-stone-300 px-4 py-2.5 text-sm"
            />
          </div>

          {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
          {passwordSaved && <p className="text-sm text-emerald-600">Пароль изменён.</p>}

          <button
            type="submit"
            disabled={passwordSaving}
            className="rounded-lg bg-brand px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {passwordSaving ? 'Сохраняем…' : 'Сменить пароль'}
          </button>
        </form>
      </section>
    </main>
  );
}
