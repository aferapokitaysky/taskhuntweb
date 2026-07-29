'use client';

import { useEffect, useState } from 'react';
import { GithubIcon } from './icons/GithubIcon';
import { StarIcon } from './icons/StarIcon';
import { ForkIcon } from './icons/ForkIcon';

interface GithubRepo {
  id: number;
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  fork: boolean;
  pushed_at: string;
}

// Официальные цвета языков GitHub (подмножество самых частых) — просто
// цветной кружок рядом с названием, как на самом GitHub.
const LANGUAGE_COLORS: Record<string, string> = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  'C++': '#f34b7d',
  'C#': '#178600',
  C: '#555555',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
};

/** Достаёт username из "https://github.com/username" (или без протокола/хвостом пути). */
export function extractGithubUsername(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(/github\.com\/([a-zA-Z0-9-]+)/i);
  return match ? match[1] : null;
}

/**
 * Публичный GitHub API не требует ключа для чтения открытых репозиториев
 * (лимит 60 запр/час на IP без авторизации — достаточно для профиля,
 * который не грузят пачками). Строка githubUrl уже есть в профиле —
 * доставать username из неё проще и надёжнее, чем городить отдельный
 * OAuth-коннект ради того же публичного результата.
 */
export function GithubRepos({ username }: { username: string }) {
  const [repos, setRepos] = useState<GithubRepo[] | null>(null);
  const [stats, setStats] = useState<{ repoCount: number; stars: number; forks: number } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRepos(null);
    setFailed(false);

    fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=pushed`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((all: GithubRepo[]) => {
        if (cancelled || !Array.isArray(all)) return;
        const stars = all.reduce((sum, r) => sum + r.stargazers_count, 0);
        const forks = all.reduce((sum, r) => sum + r.forks_count, 0);
        setStats({ repoCount: all.length, stars, forks });

        const top = all
          .filter((r) => !r.fork)
          .sort((a, b) => b.stargazers_count + b.forks_count - (a.stargazers_count + a.forks_count))
          .slice(0, 6);
        setRepos(top);
      })
      .catch(() => !cancelled && setFailed(true));

    return () => {
      cancelled = true;
    };
  }, [username]);

  if (failed || (repos && repos.length === 0)) return null;

  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-serif text-lg text-stone-900">
          <GithubIcon className="h-5 w-5" />
          GitHub
        </h2>
        {stats && (
          <a
            href={`https://github.com/${username}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-stone-500 hover:text-brand"
          >
            {stats.repoCount} репозиториев · {stats.stars} ★ · {stats.forks} форков
          </a>
        )}
      </div>

      {!repos ? (
        <p className="text-sm text-stone-400">Загружаем репозитории…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {repos.map((repo) => (
            <a
              key={repo.id}
              href={repo.html_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
            >
              <p className="font-medium text-stone-900">{repo.name}</p>
              {repo.description && <p className="mt-1 line-clamp-2 text-sm text-stone-600">{repo.description}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-stone-500">
                {repo.language && (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: LANGUAGE_COLORS[repo.language] ?? '#8b8b8b' }}
                    />
                    {repo.language}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <StarIcon className="h-3.5 w-3.5" filled />
                  {repo.stargazers_count}
                </span>
                <span className="inline-flex items-center gap-1">
                  <ForkIcon className="h-3.5 w-3.5" />
                  {repo.forks_count}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
