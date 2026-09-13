'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Globe2,
  Search,
  Sprout,
} from 'lucide-react';
import type { LibraryData } from '../shared/types';
import { api } from './api';
import { ErrorBox, Loading } from './components';
export function useLibrary(initialData?: LibraryData) {
  return useQuery({
    queryKey: ['library'],
    queryFn: () => api<LibraryData>('/library'),
    staleTime: Infinity,
    initialData,
  });
}
export function Library({
  articleId,
  initialData,
}: {
  articleId?: string;
  initialData: LibraryData;
}) {
  const library = useLibrary(initialData);
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('All countries');
  if (library.isPending) return <Loading />;
  if (library.error) return <ErrorBox error={library.error} />;
  if (articleId) {
    const forest = library.data.forests.find((f) => f.id === articleId);
    if (!forest)
      return (
        <div className="empty">
          <h1>Forest not found</h1>
          <Link href="/forests">Back to atlas</Link>
        </div>
      );
    return (
      <article className="article">
        <Link className="back" href="/forests">
          <ArrowLeft size={15} />
          Forest atlas
        </Link>
        <span className="eyebrow">{forest.country} / FOREST FIELD NOTES</span>
        <h1>{forest.title}</h1>
        <p className="article-subtitle">{forest.subtitle}</p>
        <div className="article-origin">
          <BookOpen size={17} /> From the original Web Wonders collection{' '}
          <a href={forest.legacyUrl}>
            Original page <ArrowUpRight size={14} />
          </a>
        </div>
        <div className="article-layout">
          <nav aria-label="Article sections">
            {forest.sections.map((s, i) => (
              <a key={i} href={`#section-${i}`}>
                {s.title}
              </a>
            ))}
          </nav>
          <div>
            {forest.sections.map((section, i) => (
              <section id={`section-${i}`} key={i}>
                <span className="section-number">{String(i + 1).padStart(2, '0')}</span>
                <h2>{section.title}</h2>
                <p>{section.text}</p>
                {section.image && (
                  <img
                    src={section.image}
                    alt={section.title}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
              </section>
            ))}
          </div>
        </div>
      </article>
    );
  }
  const countries = [...new Set(library.data.forests.map((f) => f.country))];
  const shown = library.data.forests.filter(
    (f) =>
      (country === 'All countries' || f.country === country) &&
      `${f.title} ${f.country} ${f.subtitle}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">THE WORLD IS WORTH EXPLORING</span>
          <h1>Forest atlas</h1>
          <p>The stories, species, and landscapes that started Crawlers.</p>
        </div>
        <span className="chip">
          <Globe2 size={15} /> 7 countries · 29 forests
        </span>
      </div>
      <div className="library-intro">
        <Sprout size={30} strokeWidth={1.4} />
        <p>
          A living connection to our roots. Explore the original team’s forest collection, now
          easier to read and discover.
        </p>
        <a href="/legacy/index.html">
          Visit the original site <ArrowUpRight size={16} />
        </a>
      </div>
      <div className="toolbar library-toolbar">
        <div className="search">
          <Search size={17} />
          <input
            aria-label="Search forests"
            placeholder="Find a forest, country, or landscape…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Filter country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        >
          {['All countries', ...countries].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <span className="muted">{shown.length} forests</span>
      </div>
      <div className="forest-grid">
        {shown.map((forest, i) => (
          <Link href={`/forests/${forest.id}`} className="forest-card" key={forest.id}>
            <div className={`forest-image tone-${i % 4}`}>
              {forest.image && (
                <img
                  src={forest.image}
                  alt=""
                  loading="lazy"
                  onLoad={(e) => e.currentTarget.parentElement?.classList.add('image-loaded')}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <Sprout className="forest-fallback" size={46} strokeWidth={1} />
              <span>{forest.country}</span>
            </div>
            <div className="forest-info">
              <span className="eyebrow">
                FIELD NOTE / {String(library.data.forests.indexOf(forest) + 1).padStart(2, '0')}
              </span>
              <h2>
                {forest.title}
                <ArrowUpRight size={19} />
              </h2>
              <p>{forest.subtitle || forest.sections[0]?.text.slice(0, 100)}</p>
              <span className="text-link">
                Explore forest <ArrowRight size={14} />
              </span>
            </div>
          </Link>
        ))}
      </div>
      {!shown.length && (
        <div className="empty">
          <Search />
          <h3>No forests found</h3>
          <p>Try another country or search phrase.</p>
        </div>
      )}
    </>
  );
}
export function Quiz({ initialData }: { initialData: LibraryData }) {
  const library = useLibrary(initialData);
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  if (library.isPending) return <Loading />;
  if (library.error) return <ErrorBox error={library.error} />;
  const questions = library.data.questions;
  const index = answers.length;
  const finished = index === questions.length;
  const score = answers.filter((a, i) => a === questions[i].answer).length;
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">A LITTLE CURIOSITY GOES A LONG WAY</span>
          <h1>Forest knowledge quiz</h1>
          <p>Discover how much you know about our planet’s forests.</p>
        </div>
      </div>
      <section className="quiz-panel panel">
        {!started ? (
          <>
            <span className="quiz-emblem">
              <Sprout size={48} strokeWidth={1.2} />
            </span>
            <span className="eyebrow">8 QUESTIONS · ONE GREEN PLANET</span>
            <h2>How deep do your roots go?</h2>
            <p>
              Explore the original Crawlers quiz. Choose an answer, learn as you go, and see your
              score at the end.
            </p>
            <button className="button primary" onClick={() => setStarted(true)}>
              Let’s find out <ArrowRight size={17} />
            </button>
          </>
        ) : finished ? (
          <>
            <Check size={42} />
            <span className="eyebrow">EXPLORATION COMPLETE</span>
            <h2>
              {score} / {questions.length}
            </h2>
            <p>
              You answered {Math.round((score / questions.length) * 100)}% correctly. Keep growing
              your forest knowledge.
            </p>
            <div className="quiz-review">
              {questions.map((q, i) => (
                <div key={q.question}>
                  <strong>
                    {answers[i] === q.answer ? '✓' : '○'} {q.question}
                  </strong>
                  <small>Correct answer: {q.answer}</small>
                </div>
              ))}
            </div>
            <div className="actions">
              <button
                className="button primary"
                onClick={() => {
                  setAnswers([]);
                  setSelected(null);
                }}
              >
                Try again
              </button>
              <Link className="button" href="/forests">
                Explore the atlas
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="quiz-top">
              <span>
                Question {index + 1} of {questions.length}
              </span>
              <span>Score {score}</span>
            </div>
            <progress value={index} max={questions.length} aria-label="Quiz progress" />
            <h2>{questions[index].question}</h2>
            <div className="answers">
              {questions[index].options.map((option) => (
                <button
                  disabled={selected !== null}
                  className={`answer ${selected !== null && option === questions[index].answer ? 'correct' : ''} ${selected === option && option !== questions[index].answer ? 'incorrect' : ''}`}
                  key={option}
                  onClick={() => setSelected(option)}
                >
                  {option}
                  <span>
                    {selected !== null && option === questions[index].answer ? (
                      <Check size={17} />
                    ) : (
                      <span className="answer-dot" />
                    )}
                  </span>
                </button>
              ))}
            </div>
            {selected && (
              <div className="quiz-feedback" role="status">
                {selected === questions[index].answer ? 'That’s right.' : 'A chance to learn.'} The
                answer is {questions[index].answer}.
              </div>
            )}
            <button
              className="button primary"
              disabled={!selected}
              onClick={() => {
                setAnswers([...answers, selected!]);
                setSelected(null);
              }}
            >
              {index === questions.length - 1 ? 'See results' : 'Next question'}
              <ArrowRight size={16} />
            </button>
          </>
        )}
      </section>
    </>
  );
}
