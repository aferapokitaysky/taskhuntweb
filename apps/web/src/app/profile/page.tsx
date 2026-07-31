'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, API_URL, createSkill, downloadFile, uploadAvatar } from '@/lib/api';
import type { BidTemplate, PortfolioItem, SessionItem, Skill, User } from '@/lib/types';
import { AppHeader } from '@/components/AppHeader';
import { GithubIcon } from '@/components/icons/GithubIcon';
import { GlobeIcon } from '@/components/icons/GlobeIcon';
import { EyeIcon } from '@/components/icons/EyeIcon';
import { ProfileNavIcon } from '@/components/icons/illustrated/ProfileNavIcon';
import { useToast } from '@/components/Toast';
import { Mascot } from '@/components/Mascot';

const MAX_SKILLS = 25;

const EMPTY_PORTFOLIO_FORM = { title: '', description: '', imageUrl: '', projectUrl: '', tags: [] as string[] };

export default function ProfilePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [isFreelancer, setIsFreelancer] = useState(false);
  const [availableForWork, setAvailableForWork] = useState(true);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [onVacation, setOnVacation] = useState(false);
  const [vacationUntil, setVacationUntil] = useState('');
  const [vacationSaving, setVacationSaving] = useState(false);
  const [viewsCount, setViewsCount] = useState(0);
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

  const [bidTemplates, setBidTemplates] = useState<BidTemplate[]>([]);
  const [showBidTemplateForm, setShowBidTemplateForm] = useState(false);
  const [editingBidTemplateId, setEditingBidTemplateId] = useState<string | null>(null);
  const [bidTemplateForm, setBidTemplateForm] = useState({ name: '', message: '', defaultDeliveryDays: '' });
  const [bidTemplateSaving, setBidTemplateSaving] = useState(false);
  const [bidTemplateError, setBidTemplateError] = useState<string | null>(null);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', repeatPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpEnrollment, setTotpEnrollment] = useState<{ qrCodeDataUrl: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpBackupCodes, setTotpBackupCodes] = useState<string[] | null>(null);
  const [totpDisablePassword, setTotpDisablePassword] = useState('');
  const [showTotpDisable, setShowTotpDisable] = useState(false);
  const [totpBusy, setTotpBusy] = useState(false);
  const [totpError, setTotpError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<SessionItem[] | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const [digestFrequency, setDigestFrequency] = useState<'NONE' | 'DAILY' | 'WEEKLY'>('NONE');
  const [digestSaving, setDigestSaving] = useState(false);

  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api<User>('/users/me'), api<Skill[]>('/skills')])
      .then(([user, skills]) => {
        setAllSkills(skills);
        setUserId(user.id);
        setForm({
          displayName: user.profile?.displayName ?? '',
          bio: user.profile?.bio ?? '',
          country: user.profile?.country ?? '',
          city: user.profile?.city ?? '',
          githubUrl: user.profile?.githubUrl ?? '',
          websiteUrl: user.profile?.websiteUrl ?? '',
        });
        setAvatarUrl(user.profile?.avatarUrl ?? null);
        setAvailableForWork(user.profile?.availableForWork ?? true);
        if (user.profile?.vacationUntil && new Date(user.profile.vacationUntil) > new Date()) {
          setOnVacation(true);
          setVacationUntil(user.profile.vacationUntil.slice(0, 10));
        }
        setViewsCount(user.profile?.viewsCount ?? 0);
        setSelectedSkillIds((user.profile?.skills ?? []).map((s) => s.skill.id));
        setPortfolioItems(user.profile?.portfolioItems ?? []);
        setTotpEnabled(user.totpEnabled ?? false);
        setDigestFrequency(user.digestFrequency ?? 'NONE');
        loadSessions();
        setIsFreelancer(user.roles.includes('FREELANCER'));
        if (user.roles.includes('FREELANCER')) {
          api<BidTemplate[]>('/users/me/bid-templates').then(setBidTemplates).catch(() => undefined);
        }
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
    await api(`/users/me/portfolio/${id}`, { method: 'DELETE' })
      .then(() => showToast('Кейс удалён', 'success'))
      .catch(() => showToast('Не удалось удалить кейс', 'error'));
  }

  function startAddBidTemplate() {
    setEditingBidTemplateId(null);
    setBidTemplateForm({ name: '', message: '', defaultDeliveryDays: '' });
    setBidTemplateError(null);
    setShowBidTemplateForm(true);
  }

  function startEditBidTemplate(template: BidTemplate) {
    setEditingBidTemplateId(template.id);
    setBidTemplateForm({
      name: template.name,
      message: template.message,
      defaultDeliveryDays: template.defaultDeliveryDays ? String(template.defaultDeliveryDays) : '',
    });
    setBidTemplateError(null);
    setShowBidTemplateForm(true);
  }

  async function submitBidTemplate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBidTemplateSaving(true);
    setBidTemplateError(null);
    const payload = {
      name: bidTemplateForm.name,
      message: bidTemplateForm.message,
      defaultDeliveryDays: bidTemplateForm.defaultDeliveryDays ? Number(bidTemplateForm.defaultDeliveryDays) : undefined,
    };
    try {
      if (editingBidTemplateId) {
        const updated = await api<BidTemplate>(`/users/me/bid-templates/${editingBidTemplateId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setBidTemplates((current) => current.map((t) => (t.id === editingBidTemplateId ? updated : t)));
      } else {
        const created = await api<BidTemplate>('/users/me/bid-templates', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setBidTemplates((current) => [created, ...current]);
      }
      setShowBidTemplateForm(false);
      setEditingBidTemplateId(null);
    } catch (err) {
      setBidTemplateError(err instanceof Error ? err.message : 'Не удалось сохранить шаблон');
    } finally {
      setBidTemplateSaving(false);
    }
  }

  async function deleteBidTemplate(id: string) {
    setBidTemplates((current) => current.filter((t) => t.id !== id));
    await api(`/users/me/bid-templates/${id}`, { method: 'DELETE' })
      .then(() => showToast('Шаблон удалён', 'success'))
      .catch(() => showToast('Не удалось удалить шаблон', 'error'));
  }

  async function toggleAvailableForWork() {
    const next = !availableForWork;
    setAvailableForWork(next);
    setAvailabilitySaving(true);
    try {
      await api('/users/me/profile', { method: 'PATCH', body: JSON.stringify({ availableForWork: next }) });
    } catch {
      setAvailableForWork(!next);
    } finally {
      setAvailabilitySaving(false);
    }
  }

  async function saveVacation(nextOnVacation: boolean, nextDate: string) {
    setVacationSaving(true);
    try {
      await api('/users/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({ vacationUntil: nextOnVacation && nextDate ? nextDate : null }),
      });
    } catch {
      // тихо — поле не критичное, повторно откроет форму и попробует снова
    } finally {
      setVacationSaving(false);
    }
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

  async function startTotpEnrollment() {
    setTotpError(null);
    setTotpBusy(true);
    try {
      const result = await api<{ qrCodeDataUrl: string }>('/auth/2fa/enroll', { method: 'POST' });
      setTotpEnrollment(result);
    } catch (err) {
      setTotpError(err instanceof Error ? err.message : 'Не удалось начать подключение 2FA');
    } finally {
      setTotpBusy(false);
    }
  }

  async function confirmTotpEnrollment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTotpError(null);
    setTotpBusy(true);
    try {
      const result = await api<{ backupCodes: string[] }>('/auth/2fa/enroll/confirm', {
        method: 'POST',
        body: JSON.stringify({ code: totpCode }),
      });
      setTotpEnabled(true);
      setTotpEnrollment(null);
      setTotpCode('');
      setTotpBackupCodes(result.backupCodes);
    } catch (err) {
      setTotpError(err instanceof Error ? err.message : 'Неверный код');
    } finally {
      setTotpBusy(false);
    }
  }

  async function disableTotp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTotpError(null);
    setTotpBusy(true);
    try {
      await api('/auth/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({ password: totpDisablePassword }),
      });
      setTotpEnabled(false);
      setShowTotpDisable(false);
      setTotpDisablePassword('');
    } catch (err) {
      setTotpError(err instanceof Error ? err.message : 'Не удалось отключить 2FA');
    } finally {
      setTotpBusy(false);
    }
  }

  async function changeDigestFrequency(frequency: 'NONE' | 'DAILY' | 'WEEKLY') {
    setDigestFrequency(frequency);
    setDigestSaving(true);
    try {
      await api('/notifications/preferences/digest', { method: 'PATCH', body: JSON.stringify({ frequency }) });
    } catch {
      // тихо — не критично, юзер увидит актуальное значение при следующей загрузке страницы
    } finally {
      setDigestSaving(false);
    }
  }

  function loadSessions() {
    setSessionsError(null);
    api<SessionItem[]>('/auth/sessions')
      .then(setSessions)
      .catch((err) => setSessionsError(err instanceof Error ? err.message : 'Не удалось загрузить сессии'));
  }

  async function revokeSession(id: string) {
    setSessions((current) => current?.filter((s) => s.id !== id) ?? null);
    await api(`/auth/sessions/${id}`, { method: 'DELETE' })
      .then(() => showToast('Сессия завершена', 'success'))
      .catch(() => showToast('Не удалось завершить сессию', 'error'));
  }

  async function revokeOtherSessions() {
    setSessions((current) => current?.filter((s) => s.isCurrent) ?? null);
    await api('/auth/sessions/revoke-others', { method: 'POST' })
      .then(() => showToast('Остальные сессии завершены', 'success'))
      .catch(() => showToast('Не удалось завершить сессии', 'error'));
  }

  function deviceLabel(userAgent?: string | null): string {
    if (!userAgent) return 'Неизвестное устройство';
    if (/mobile|iphone|android/i.test(userAgent)) return 'Мобильное устройство';
    if (/ipad|tablet/i.test(userAgent)) return 'Планшет';
    return 'Компьютер';
  }

  async function exportMyData() {
    setExportError(null);
    setExportBusy(true);
    try {
      await downloadFile('/users/me/export', 'taskhunt-data.json');
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Не удалось скачать данные');
    } finally {
      setExportBusy(false);
    }
  }

  async function deleteAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setDeleteError(null);
    setDeleteBusy(true);
    try {
      await api('/users/me', { method: 'DELETE', body: JSON.stringify({ password: deletePassword }) });
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      router.push('/');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Не удалось удалить аккаунт');
      setDeleteBusy(false);
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

  const selectedSkills = allSkills.filter((skill) => selectedSkillIds.includes(skill.id));
  const profileCompletionItems = [
    Boolean(form.displayName.trim()),
    Boolean(form.bio.trim()),
    Boolean(form.city.trim() || form.country.trim()),
    selectedSkillIds.length >= 3,
    portfolioItems.length > 0,
    Boolean(form.githubUrl.trim() || form.websiteUrl.trim()),
  ];
  const profileCompletion = Math.round((profileCompletionItems.filter(Boolean).length / profileCompletionItems.length) * 100);
  const nextProfileStep =
    ([
      [!form.displayName.trim(), 'Добавьте имя, которое увидят клиенты'],
      [!form.bio.trim(), 'Опишите, какие задачи вы закрываете лучше всего'],
      [!(form.city.trim() || form.country.trim()), 'Укажите локацию для доверия в профиле'],
      [selectedSkillIds.length < 3, 'Выберите минимум 3 навыка для точного матчинга'],
      [portfolioItems.length === 0, 'Добавьте первый кейс в портфолио'],
      [!(form.githubUrl.trim() || form.websiteUrl.trim()), 'Прикрепите GitHub или сайт с работами'],
    ] as Array<[boolean, string]>).find(([missing]) => missing)?.[1] ?? 'Профиль выглядит готовым к показу заказчикам';
  const profileQuality = [
    { label: 'Имя', done: Boolean(form.displayName.trim()) },
    { label: 'Описание', done: Boolean(form.bio.trim()) },
    { label: 'Локация', done: Boolean(form.city.trim() || form.country.trim()) },
    { label: 'Навыки', done: selectedSkillIds.length >= 3 },
    { label: 'Портфолио', done: portfolioItems.length > 0 },
    { label: 'Ссылки', done: Boolean(form.githubUrl.trim() || form.websiteUrl.trim()) },
  ];

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <AppHeader />
        <p className="text-stone-500">Загружаем профиль…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <AppHeader />

      <section className="workspace-hero mb-6 p-6 md:p-8">
        <div className="relative grid gap-6 lg:grid-cols-[1fr_320px] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Профиль TaskHunt</p>
            <h1 className="mt-3 max-w-2xl font-serif text-3xl leading-tight text-stone-950 md:text-5xl">
              {form.displayName ? `${form.displayName}, усиливаем вашу витрину` : 'Соберите профиль, которому доверяют'}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-600">
              Заполненный профиль лучше попадает в рекомендации, быстрее объясняет экспертизу и снижает лишние вопросы перед стартом заказа.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-stone-700">
              <span className="rounded-full border border-stone-200 bg-white/70 px-3 py-1.5">{isFreelancer ? 'Фрилансер' : 'Заказчик'}</span>
              <span className="rounded-full border border-stone-200 bg-white/70 px-3 py-1.5">
                {availableForWork ? 'Открыт для задач' : 'Пауза в заказах'}
              </span>
              <span className="rounded-full border border-stone-200 bg-white/70 px-3 py-1.5">{viewsCount} просмотров</span>
            </div>
          </div>
          <div className="rounded-3xl border border-stone-100 bg-white/65 p-5 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase text-stone-400">Заполнение</p>
                <p className="mt-1 font-serif text-4xl text-stone-950">{profileCompletion}%</p>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-brand" style={{ width: `${profileCompletion}%` }} />
            </div>
            <p className="mt-3 text-sm leading-5 text-stone-600">{nextProfileStep}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr] lg:items-start">
        <div className="lg:sticky lg:top-6">
          <aside className="premium-panel overflow-hidden rounded-[2rem] p-0">
            <div className="bg-gradient-to-br from-card-sand/80 via-white to-card-sage/60 p-6 text-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="group relative mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-[2rem] border-4 border-white bg-gradient-to-br from-card-sand to-card-sage shadow-xl shadow-stone-900/10 transition hover:-translate-y-0.5 disabled:opacity-60"
                title="Загрузить фото"
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${API_URL}${avatarUrl}`} alt="Аватар" className="h-full w-full object-cover" />
                ) : (
                  <ProfileNavIcon className="h-24 w-24 translate-y-2" />
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-stone-950/55 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
                  {avatarUploading ? 'Загрузка' : 'Изменить'}
                </span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAvatarChange} className="hidden" />

              <p className="mt-4 font-serif text-2xl text-stone-950">{form.displayName || 'Без имени'}</p>
              <p className="text-sm text-stone-500">{[form.city, form.country].filter(Boolean).join(', ') || 'Локация не указана'}</p>
              {avatarError && <p className="mt-1 text-xs text-red-600">{avatarError}</p>}

              <button
                type="button"
                onClick={toggleAvailableForWork}
                disabled={availabilitySaving}
                className={`mt-5 flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
                  availableForWork ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-stone-300 bg-white/70 text-stone-500'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${availableForWork ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                {availableForWork ? 'Открыт для заказов' : 'Не ищу заказы'}
              </button>

              {userId && (
                <Link href={`/freelancers/${userId}`} target="_blank" className="secondary-action mt-3 block px-4 py-2.5 text-sm">
                  Публичный профиль
                </Link>
              )}
            </div>

            <div className="border-t border-stone-100 p-5">
              <label className="flex items-center justify-between gap-3 rounded-2xl bg-stone-50 px-3 py-3 text-sm font-medium text-stone-700">
                <span>Отпуск</span>
                <input
                  type="checkbox"
                  checked={onVacation}
                  disabled={vacationSaving}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setOnVacation(checked);
                    saveVacation(checked, vacationUntil);
                  }}
                />
              </label>
              {onVacation && (
                <input
                  type="date"
                  value={vacationUntil}
                  onChange={(e) => {
                    setVacationUntil(e.target.value);
                    saveVacation(true, e.target.value);
                  }}
                  className="field-surface mt-2 w-full px-3 py-2 text-sm"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-stone-100 p-5 text-center">
              <div className="min-w-0 rounded-2xl bg-card-sand/70 p-3">
                <p className="font-serif text-xl text-stone-950">{selectedSkillIds.length}</p>
                <p className="text-[11px] uppercase text-stone-500">навыков</p>
              </div>
              <div className="min-w-0 rounded-2xl bg-card-sage/70 p-3">
                <p className="font-serif text-xl text-stone-950">{portfolioItems.length}</p>
                <p className="text-[11px] uppercase text-stone-500">кейсов</p>
              </div>
              <div className="col-span-2 min-w-0 rounded-2xl bg-card-lavender/70 p-3">
                <p className="flex items-center justify-center gap-1 font-serif text-xl text-stone-950">
                  <EyeIcon className="h-4 w-4 text-stone-400" />
                  {viewsCount}
                </p>
                <p className="text-[11px] uppercase text-stone-500">просмотров</p>
              </div>
            </div>

            {(form.githubUrl || form.websiteUrl) && (
              <div className="flex flex-col gap-2 border-t border-stone-100 p-5">
                {form.githubUrl && (
                  <a href={form.githubUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-2xl bg-stone-50 px-3 py-2 text-sm text-stone-600 transition hover:text-brand">
                    <GithubIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{form.githubUrl.replace(/^https?:\/\//, '')}</span>
                  </a>
                )}
                {form.websiteUrl && (
                  <a href={form.websiteUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-2xl bg-stone-50 px-3 py-2 text-sm text-stone-600 transition hover:text-brand">
                    <GlobeIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{form.websiteUrl.replace(/^https?:\/\//, '')}</span>
                  </a>
                )}
              </div>
            )}

            {selectedSkills.length > 0 && (
              <div className="border-t border-stone-100 p-5">
                <p className="text-xs font-semibold uppercase text-stone-400">Фокус профиля</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedSkills.slice(0, 8).map((skill) => (
                    <span key={skill.id} className="rounded-full bg-card-sage px-3 py-1 text-xs font-semibold text-stone-800">
                      {skill.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-stone-100 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase text-stone-400">Чеклист качества</p>
                <Mascot name="guideQuestion" size="h-12 w-12" />
              </div>
              <div className="mt-4 space-y-2">
                {profileQuality.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-2xl bg-stone-50 px-3 py-2">
                    <span className="text-sm font-medium text-stone-700">{item.label}</span>
                    <span className={`h-2.5 w-2.5 rounded-full ${item.done ? 'bg-emerald-500' : 'bg-stone-300'}`} />
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <div className="space-y-6">
      <form onSubmit={handleSubmit} className="premium-panel overflow-hidden p-0">
        <div className="border-b border-stone-100 bg-gradient-to-br from-white via-card-sand/40 to-card-lavender/35 p-6">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-stone-400">Основное</p>
            <h2 className="mt-1 font-serif text-2xl text-stone-900">Публичные данные</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">
              Это витрина, по которой заказчик решает, писать вам или пролистать дальше. Чем конкретнее профиль, тем лучше рекомендации.
            </p>
          </div>
          <span className="rounded-full bg-card-sand px-3 py-1 text-xs font-semibold text-stone-700">
            {profileCompletion}% готово
          </span>
        </div>
        </div>

        <div className="space-y-4 p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-600">Имя</label>
          <input
            required
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            className="field-surface w-full px-4 py-3"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-stone-600">О себе</label>
          <textarea
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            className="field-surface min-h-28 w-full px-4 py-3"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-600">Страна</label>
            <input
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              className="field-surface w-full px-4 py-3"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-600">Город</label>
            <input
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              className="field-surface w-full px-4 py-3"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-600">GitHub</label>
            <input
              type="url"
              placeholder="https://github.com/username"
              value={form.githubUrl}
              onChange={(e) => setForm((f) => ({ ...f, githubUrl: e.target.value }))}
              className="field-surface w-full px-4 py-3"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-600">Сайт/портфолио</label>
            <input
              type="url"
              placeholder="https://..."
              value={form.websiteUrl}
              onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
              className="field-surface w-full px-4 py-3"
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-medium text-stone-600">Навыки</label>
            <span className="text-xs text-stone-400">
              {selectedSkillIds.length}/{MAX_SKILLS}
            </span>
          </div>
          <div className="max-h-60 overflow-y-auto rounded-3xl border border-stone-100 bg-stone-50/70 p-3">
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
              className="field-surface w-full px-3 py-2 text-sm disabled:opacity-60"
            />
            {skillError && <p className="mt-1 text-xs text-red-600">{skillError}</p>}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-emerald-600">Профиль сохранён.</p>}

        <button
          type="submit"
          disabled={saving}
          className="primary-action px-6 py-3 font-medium disabled:opacity-50"
        >
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </button>
        </div>
      </form>

      <section className="premium-panel p-6">
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
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {portfolioItems.map((item) => (
              <div key={item.id} className="interactive-card rounded-2xl p-4">
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
          <form onSubmit={submitPortfolio} className="space-y-3 rounded-2xl border border-stone-100 bg-stone-50/60 p-4">
            <input
              required
              placeholder="Название кейса"
              value={portfolioForm.title}
              onChange={(e) => setPortfolioForm((f) => ({ ...f, title: e.target.value }))}
              className="field-surface w-full px-3 py-2 text-sm"
            />
            <textarea
              placeholder="Описание"
              value={portfolioForm.description}
              onChange={(e) => setPortfolioForm((f) => ({ ...f, description: e.target.value }))}
              className="field-surface min-h-20 w-full px-3 py-2 text-sm"
            />
            <input
              placeholder="Ссылка на картинку (необязательно)"
              value={portfolioForm.imageUrl}
              onChange={(e) => setPortfolioForm((f) => ({ ...f, imageUrl: e.target.value }))}
              className="field-surface w-full px-3 py-2 text-sm"
            />
            <input
              placeholder="Ссылка на проект (необязательно)"
              value={portfolioForm.projectUrl}
              onChange={(e) => setPortfolioForm((f) => ({ ...f, projectUrl: e.target.value }))}
              className="field-surface w-full px-3 py-2 text-sm"
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
                className="field-surface w-full px-3 py-2 text-sm"
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
                className="primary-action px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {portfolioSaving ? 'Сохраняем…' : editingPortfolioId ? 'Сохранить изменения' : 'Добавить'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPortfolioForm(false);
                  setEditingPortfolioId(null);
                }}
                className="secondary-action px-4 py-2 text-sm font-medium"
              >
                Отмена
              </button>
            </div>
          </form>
        )}
      </section>

      {isFreelancer && (
        <section className="premium-panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-xl text-stone-900">Шаблоны откликов</h2>
            {!showBidTemplateForm && (
              <button
                type="button"
                onClick={startAddBidTemplate}
                className="rounded-full border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:border-brand hover:text-brand"
              >
                + Добавить шаблон
              </button>
            )}
          </div>

          {bidTemplates.length > 0 && (
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              {bidTemplates.map((template) => (
                <div key={template.id} className="interactive-card rounded-2xl p-4">
                  <p className="font-medium text-stone-900">{template.name}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-stone-600">{template.message}</p>
                  {template.defaultDeliveryDays && (
                    <p className="mt-1 text-xs text-stone-400">Срок по умолчанию: {template.defaultDeliveryDays} дн.</p>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-sm">
                    <button type="button" onClick={() => startEditBidTemplate(template)} className="text-stone-500 hover:text-stone-700">
                      Изменить
                    </button>
                    <button type="button" onClick={() => deleteBidTemplate(template.id)} className="text-stone-400 hover:text-red-600">
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {bidTemplates.length === 0 && !showBidTemplateForm && (
            <p className="text-sm text-stone-400">
              Пока пусто — сохраните заготовку текста отклика, чтобы быстро применять её к похожим заказам.
            </p>
          )}

          {showBidTemplateForm && (
            <form onSubmit={submitBidTemplate} className="space-y-3 rounded-2xl border border-stone-100 bg-stone-50/60 p-4">
              <input
                required
                placeholder="Название шаблона"
                value={bidTemplateForm.name}
                onChange={(e) => setBidTemplateForm((f) => ({ ...f, name: e.target.value }))}
                className="field-surface w-full px-3 py-2 text-sm"
              />
              <textarea
                required
                placeholder="Текст отклика"
                value={bidTemplateForm.message}
                onChange={(e) => setBidTemplateForm((f) => ({ ...f, message: e.target.value }))}
                className="field-surface min-h-24 w-full px-3 py-2 text-sm"
              />
              <input
                type="number"
                min="1"
                placeholder="Срок по умолчанию, дней (необязательно)"
                value={bidTemplateForm.defaultDeliveryDays}
                onChange={(e) => setBidTemplateForm((f) => ({ ...f, defaultDeliveryDays: e.target.value }))}
                className="field-surface w-full px-3 py-2 text-sm"
              />

              {bidTemplateError && <p className="text-sm text-red-600">{bidTemplateError}</p>}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={bidTemplateSaving}
                  className="primary-action px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {bidTemplateSaving ? 'Сохраняем…' : editingBidTemplateId ? 'Сохранить изменения' : 'Добавить'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBidTemplateForm(false);
                    setEditingBidTemplateId(null);
                  }}
                  className="secondary-action px-4 py-2 text-sm font-medium"
                >
                  Отмена
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      <section className="premium-panel p-6">
        <h2 className="mb-4 font-serif text-xl text-stone-900">Безопасность</h2>
        <form onSubmit={submitPasswordChange} className="max-w-sm space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-600">Текущий пароль</label>
            <input
              required
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
              className="field-surface w-full px-4 py-2.5 text-sm"
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
              className="field-surface w-full px-4 py-2.5 text-sm"
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
              className="field-surface w-full px-4 py-2.5 text-sm"
            />
          </div>

          {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
          {passwordSaved && <p className="text-sm text-emerald-600">Пароль изменён.</p>}

          <button
            type="submit"
            disabled={passwordSaving}
            className="primary-action px-6 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {passwordSaving ? 'Сохраняем…' : 'Сменить пароль'}
          </button>
        </form>

        <div className="mt-6 max-w-sm border-t border-stone-100 pt-6">
          <h3 className="mb-1 font-medium text-stone-900">Двухфакторная аутентификация</h3>

          {totpBackupCodes ? (
            <div>
              <p className="mb-2 text-sm text-stone-600">
                2FA включена. Сохраните резервные коды — каждый работает один раз, если потеряете доступ к
                приложению-аутентификатору. Больше мы их не покажем.
              </p>
              <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-stone-50 p-3 font-mono text-sm">
                {totpBackupCodes.map((code) => (
                  <span key={code}>{code}</span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setTotpBackupCodes(null)}
                className="primary-action mt-3 px-4 py-2 text-sm font-medium"
              >
                Готово, я сохранил коды
              </button>
            </div>
          ) : totpEnrollment ? (
            <form onSubmit={confirmTotpEnrollment} className="space-y-3">
              <p className="text-sm text-stone-600">Отсканируйте QR-код в приложении-аутентификаторе (Google Authenticator, Authy) и введите код:</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={totpEnrollment.qrCodeDataUrl} alt="QR-код для 2FA" className="h-40 w-40 rounded-lg border border-stone-200" />
              <input
                required
                inputMode="numeric"
                placeholder="6-значный код"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                className="field-surface w-full px-4 py-2.5 text-sm"
              />
              {totpError && <p className="text-sm text-red-600">{totpError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={totpBusy}
                  className="primary-action px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  Подтвердить
                </button>
                <button
                  type="button"
                  onClick={() => setTotpEnrollment(null)}
                  className="secondary-action px-4 py-2 text-sm font-medium"
                >
                  Отмена
                </button>
              </div>
            </form>
          ) : totpEnabled ? (
            showTotpDisable ? (
              <form onSubmit={disableTotp} className="space-y-3">
                <label className="block text-sm text-stone-600">Введите пароль, чтобы отключить 2FA:</label>
                <input
                  required
                  type="password"
                  value={totpDisablePassword}
                  onChange={(e) => setTotpDisablePassword(e.target.value)}
                  className="field-surface w-full px-4 py-2.5 text-sm"
                />
                {totpError && <p className="text-sm text-red-600">{totpError}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={totpBusy}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Отключить 2FA
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTotpDisable(false)}
                    className="secondary-action px-4 py-2 text-sm font-medium"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">Включена</span>
                <button
                  type="button"
                  onClick={() => setShowTotpDisable(true)}
                  className="text-sm font-medium text-stone-500 hover:text-red-600"
                >
                  Отключить
                </button>
              </div>
            )
          ) : (
            <div>
              <p className="mb-2 text-sm text-stone-600">Дополнительный код из приложения при входе — защищает аккаунт, даже если пароль утёк.</p>
              {totpError && <p className="mb-2 text-sm text-red-600">{totpError}</p>}
              <button
                type="button"
                onClick={startTotpEnrollment}
                disabled={totpBusy}
                className="secondary-action px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Включить 2FA
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 border-t border-stone-100 pt-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-medium text-stone-900">Активные сессии</h3>
            {sessions && sessions.length > 1 && (
              <button type="button" onClick={revokeOtherSessions} className="text-sm font-medium text-stone-500 hover:text-red-600">
                Завершить все остальные
              </button>
            )}
          </div>
          {sessionsError && <p className="text-sm text-red-600">{sessionsError}</p>}
          {!sessions && !sessionsError && <p className="text-sm text-stone-400">Загружаем сессии…</p>}
          <div className="space-y-2">
            {sessions?.map((session) => (
              <div key={session.id} className="flex items-center justify-between rounded-2xl border border-stone-100 bg-white px-4 py-2.5 text-sm shadow-sm">
                <div>
                  <p className="font-medium text-stone-800">
                    {deviceLabel(session.userAgent)}
                    {session.isCurrent && <span className="ml-2 text-xs font-normal text-emerald-600">Это устройство</span>}
                  </p>
                  <p className="text-xs text-stone-500">
                    {session.ip} · последняя активность {new Date(session.lastUsedAt).toLocaleString('ru-RU')}
                  </p>
                </div>
                {!session.isCurrent && (
                  <button type="button" onClick={() => revokeSession(session.id)} className="text-stone-400 hover:text-red-600">
                    Завершить
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="premium-panel p-6">
        <h2 className="mb-4 font-serif text-xl text-stone-900">Уведомления</h2>
        <div className="max-w-sm">
          <p className="mb-2 text-sm text-stone-600">Сводка непрочитанных уведомлений на email:</p>
          <div className="flex gap-2">
            {(
              [
                ['NONE', 'Не присылать'],
                ['DAILY', 'Раз в день'],
                ['WEEKLY', 'Раз в неделю'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                disabled={digestSaving}
                onClick={() => changeDigestFrequency(value)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition disabled:opacity-60 ${
                  digestFrequency === value ? 'border-brand bg-brand/10 text-brand' : 'border-stone-300 text-stone-600 hover:border-stone-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="premium-panel p-6">
        <h2 className="mb-4 font-serif text-xl text-stone-900">Данные и приватность</h2>

        <div className="max-w-sm">
          <p className="mb-2 text-sm text-stone-600">Скачайте копию всех своих данных на TaskHunt в формате JSON.</p>
          {exportError && <p className="mb-2 text-sm text-red-600">{exportError}</p>}
          <button
            type="button"
            onClick={exportMyData}
            disabled={exportBusy}
            className="secondary-action px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {exportBusy ? 'Готовим файл…' : 'Скачать мои данные'}
          </button>
        </div>

        <div className="mt-6 max-w-sm border-t border-stone-100 pt-6">
          <h3 className="mb-1 font-medium text-red-700">Удалить аккаунт</h3>
          <p className="mb-2 text-sm text-stone-600">
            Необратимо: вход станет невозможен, имя и фото профиля заменятся на «Удалённый пользователь». История
            заказов и платежей у ваших контрагентов сохранится — это нужно им для их собственной отчётности.
          </p>

          {showDeleteAccount ? (
            <form onSubmit={deleteAccount} className="space-y-3">
              <label className="block text-sm text-stone-600">Введите пароль, чтобы подтвердить удаление:</label>
              <input
                required
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="field-surface w-full px-4 py-2.5 text-sm"
              />
              {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={deleteBusy}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {deleteBusy ? 'Удаляем…' : 'Удалить аккаунт навсегда'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteAccount(false)}
                  className="secondary-action px-4 py-2 text-sm font-medium"
                >
                  Отмена
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowDeleteAccount(true)}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Удалить аккаунт
            </button>
          )}
        </div>
      </section>
        </div>
      </div>
    </main>
  );
}
