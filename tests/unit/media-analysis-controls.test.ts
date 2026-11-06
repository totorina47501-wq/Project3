import { createElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import * as controls from '../../components/MediaJobsPanel';

const props = {
  jobId: '11111111-1111-4111-8111-111111111111', kind: 'video', includeAudio: false,
  busy: false, runs: [], error: '', onAudioChange: vi.fn(), onAnalyze: vi.fn(), onRefresh: vi.fn(),
};

function nodes(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (!node || typeof node !== 'object' || !('props' in node)) return [];
  const element = node as ReactElement<Record<string, unknown>>;
  return [element, ...[element.props.children].flat().flatMap(child => nodes(child as ReactNode))];
}

describe('Analyse IA explicite des médias préparés', () => {
  it('laisse la transcription décochée et ne lance aucune analyse au rendu', () => {
    expect(controls.PreparedMediaAnalysisControls).toBeTypeOf('function');
    const html = renderToStaticMarkup(createElement(controls.PreparedMediaAnalysisControls, props));
    expect(html).toContain('Analyser avec Mia');
    expect(html).toContain('Inclure la transcription audio');
    expect(html).not.toContain('checked=""');
    expect(html).toContain('Une analyse consomme une vérification');
    expect(html).toContain('trois images');
    expect(props.onAnalyze).not.toHaveBeenCalled();
  });

  it('attend le clic et transmet le choix audio du créateur', () => {
    const onAnalyze = vi.fn();
    const tree = controls.PreparedMediaAnalysisControls({ ...props, includeAudio: true, onAnalyze });
    const button = nodes(tree).find(node => node.type === 'button' && node.props.children === 'Analyser avec Mia');
    expect(button).toBeDefined();
    (button!.props.onClick as () => void)();
    expect(onAnalyze).toHaveBeenCalledWith(true);
  });

  it('ne propose pas de transcription pour un carrousel', () => {
    const html = renderToStaticMarkup(createElement(controls.PreparedMediaAnalysisControls, { ...props, kind: 'carousel' }));
    expect(html).not.toContain('Inclure la transcription audio');
    expect(html).toContain('Analyser avec Mia');
  });

  it('bloque une seconde analyse en cours et propose seulement une actualisation de lecture', () => {
    const html = renderToStaticMarkup(createElement(controls.PreparedMediaAnalysisControls, { ...props, runs: [{
      id: 'run', include_audio: false, status: 'processing' as const, verification_id: 'verification',
      created_at: '2026-11-05T12:00:00Z', completed_at: null,
    }] }));
    expect(html).toContain('Analyse IA en cours');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Analyser avec Mia<\/button>/);
    expect(html).toContain('Consulter les analyses IA');
  });

  it('retrouve une analyse terminée dans les archives sans la relancer', () => {
    const html = renderToStaticMarkup(createElement(controls.PreparedMediaAnalysisControls, { ...props, runs: [{
      id: 'run', include_audio: false, status: 'completed' as const, verification_id: 'verification',
      created_at: '2026-11-05T12:00:00Z', completed_at: '2026-11-05T12:01:00Z',
    }] }));
    expect(html).toContain('/dashboard/archive/verification');
    expect(html).toContain('Consulter le résultat IA');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Analyser avec Mia<\/button>/);
  });

  it('annonce les erreurs et empêche les tentatives payantes automatiques après échec', () => {
    const html = renderToStaticMarkup(createElement(controls.PreparedMediaAnalysisControls, { ...props,
      error: 'Transcription momentanément désactivée.', runs: [{
        id: 'run', include_audio: false, status: 'failed' as const, verification_id: 'verification',
        created_at: '2026-11-05T12:00:00Z', completed_at: '2026-11-05T12:01:00Z',
      }],
    }));
    expect(html).toContain('role="alert"');
    expect(html).toContain('Transcription momentanément désactivée.');
    expect(html).toContain('Aucune nouvelle tentative IA automatique');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Analyser avec Mia<\/button>/);
  });
});
