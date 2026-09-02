/**
 * Die zwei Stapel-Wege der Schleuse.
 *
 * Der Bauplan setzt sie in die Kammerköpfe: „Alle → ②" über dem Eingang,
 * „Alle ▣ nur hier" über der Quarantäne. Sie sind der letzte Rest, den die alte
 * `social/SocialTrendsView.ts` konnte und die Schleuse nicht — und damit das,
 * was Schritt 8 (die alte View löschen) bis heute blockiert hat.
 *
 * ── WARUM EIN EIGENES MODUL UND KEINE METHODEN IN DER VIEW ──────────────────
 *
 * Beide Wege sind API-Orchestrierung mit Fortschrittsanzeige, nicht Auszeichnung.
 * `IntakeView` ist schon über tausend Zeilen und ihre Aufgabe ist das Brett;
 * `IntakeStateManager` hält Zustand und Übergänge, nicht Aufrufe. Dazwischen
 * fehlte eine Stelle, und das hier ist sie.
 *
 * ── DIE STAPEL-VERWANDLUNG SETZT KEINE LINSE, UND DAS IST DER PUNKT ─────────
 *
 * Der Bauplan schreibt „Batch-Transform mit Abo-Linse". Abonnements gibt es
 * nicht (Lücke 6: weder Tabelle noch Endpunkt), also gäbe es keine Linse, die
 * man anwenden könnte — man müsste eine erfinden.
 *
 * Und eine erfundene Linse ist hier teuer: sie trägt den ORT, an dem das
 * Ereignis in der Welt eintritt. Zehn Ereignisse in eine Zone zu legen, weil
 * das die erste in der Liste war, ist keine Voreinstellung, sondern eine
 * Entscheidung, die jemand anderes gefällt hat und niemand gesehen hat.
 *
 * Die Stapel-Verwandlung setzt deshalb NUR den Vorschlag (Titel und Text, beide
 * vom Modell) und lässt die Linse leer. Die Quarantäne-Karte sagt dann von
 * selbst „Es ist keine Linse gesetzt. Öffne den Schmelztiegel." — dieser Satz
 * stand schon da, seit Schritt 4, für genau diesen Fall.
 *
 * 🔑 Ein Stapel darf abnehmen, was gleichförmig ist (fünfzehn Texte erzeugen),
 * und nicht, was je Stück eine Entscheidung IST (wo es passiert).
 *
 * ── DIE STAPEL-AUFNAHME RESPEKTIERT DIE TAGESQUOTE ──────────────────────────
 *
 * `q → ev` ist der einzige Übergang, den die Quote deckelt. Die Einzelaufnahme
 * in `IntakeQuarantineCard` prüft sie seit Schritt 4; ein Stapel, der sie
 * überginge, wäre eine Umgehung mit einem Knopf. Er nimmt deshalb höchstens so
 * viele, wie die Quote noch hergibt, und sagt beides an: wie viele es wurden
 * und wie viele liegen bleiben.
 */

import { msg, str } from '@lit/localize';
import { socialTrendsApi } from '../../services/api/index.js';
import { generationProgress } from '../../services/GenerationProgressService.js';
import { intakeState } from '../../services/IntakeStateManager.js';
import { captureError } from '../../services/SentryService.js';
import { transformRequestOf } from '../../types/intake.js';
import { VelgToast } from '../shared/Toast.js';

/**
 * Wie viele Agenten auf ein gestapelt aufgenommenes Ereignis reagieren dürfen.
 *
 * Der Wert der alten View, unverändert übernommen. Er gilt für das STÄRKSTE
 * Ereignis des Stapels (`generate_reactions_for_top`), nicht für jedes — sonst
 * kostete ein Stapel von zehn das Zwanzigfache an Modellaufrufen.
 */
const BATCH_REACTION_AGENTS = 20;

/**
 * Alles im Eingang verwandeln: `in → q`, nur der Vorschlag, ohne Linse.
 *
 * Gibt zurück, wie viele Vorschläge entstanden sind.
 */
export async function batchTransformEntrance(simulationId: string): Promise<number> {
  const signals = intakeState.inEntrance.value;
  if (signals.length === 0 || !simulationId) return 0;

  let created = 0;

  try {
    await generationProgress.withProgress(
      {
        title: msg('Transforming the entrance'),
        steps: [
          { id: 'transform', label: msg('Writing proposals') },
          { id: 'complete', label: msg('Complete') },
        ],
      },
      async (progress) => {
        progress.setStep(
          'transform',
          msg(str`Writing ${signals.length} proposals...`),
          msg('Each one still needs a place before it becomes an event.'),
        );

        const resp = await socialTrendsApi.batchTransform(simulationId, {
          articles: signals.map((s) => transformRequestOf(s)),
        });

        if (!resp.success || !resp.data) {
          progress.setError(resp.error?.message ?? msg('The batch transformation failed.'));
          return;
        }

        /*
         * Die Antwort kommt OHNE die Kennung des Signals zurück — sie trägt
         * `article_name`, also den Titel, den wir hingeschickt haben. Deshalb
         * wird über den Titel zugeordnet, und zwar über den GESENDETEN
         * (`transformRequestOf(...).article_name`), nicht über `headline`:
         * bei einem Scanner-Kandidaten sind das zwei verschiedene Felder.
         */
        const byName = new Map(signals.map((s) => [transformRequestOf(s).article_name, s]));

        for (const row of resp.data) {
          const signal = byName.get(row.article_name);
          if (!signal || !row.transformation) continue;

          const title = row.transformation.title || row.article_name;
          const body =
            row.transformation.description ||
            row.transformation.narrative ||
            row.transformation.content ||
            '';

          // KEINE Linse: der Ort ist eine Entscheidung, siehe Kopfkommentar.
          intakeState.toQuarantine(signal.id, {
            lens: undefined,
            proposal: { title, body },
          });
          created += 1;
        }

        progress.complete(msg(str`${created} proposals written`));
      },
    );
  } catch (err) {
    // Die sichtbare Meldung kommt schon aus `progress.setError`; hier geht die
    // rohe Ursache nach Sentry.
    captureError(err, { source: 'intake-batch.batchTransformEntrance' });
  }

  return created;
}

/**
 * Alles in der Quarantäne aufnehmen, das eine Linse hat: `q → ev`.
 *
 * Deckelt an der Tagesquote und sagt an, was liegen bleibt.
 */
export async function batchIntegrateQuarantine(simulationId: string): Promise<number> {
  if (!simulationId) return 0;

  const ready = intakeState.inQuarantine.value.filter((s) => s.lens && s.proposal);
  if (ready.length === 0) {
    VelgToast.info(msg('Nothing in quarantine has a lens yet. The crucible gives it one.'));
    return 0;
  }

  const remaining = Math.max(0, intakeState.dailyQuota.value - intakeState.eventsToday.value);
  if (remaining === 0) {
    VelgToast.error(msg('The daily quota is used up. Nothing was admitted.'));
    return 0;
  }

  const taking = ready.slice(0, remaining);
  const leftBehind = ready.length - taking.length;
  let admitted = 0;

  try {
    await generationProgress.withProgress(
      {
        title: msg('Admitting to this world'),
        steps: [
          { id: 'integrate', label: msg('Creating events') },
          { id: 'complete', label: msg('Complete') },
        ],
      },
      async (progress) => {
        progress.setStep('integrate', msg(str`Creating ${taking.length} events...`));

        const resp = await socialTrendsApi.batchIntegrate(simulationId, {
          items: taking.map((s) => ({
            title: s.proposal?.title ?? s.headline,
            description: s.proposal?.body ?? '',
            event_type: s.lens?.type || undefined,
            impact_level: s.lens?.impact,
            tags: [s.source, 'intake'],
            source_article: { ...transformRequestOf(s) },
          })),
          generate_reactions_for_top: true,
          max_reaction_agents: BATCH_REACTION_AGENTS,
        });

        if (!resp.success || !resp.data) {
          progress.setError(resp.error?.message ?? msg('The batch admission failed.'));
          return;
        }

        /*
         * Nur so viele Signale weiterschieben, wie der Server WIRKLICH angelegt
         * hat. Die Antwort führt `events` und `errors` getrennt; alles auf `ev`
         * zu setzen, weil der Aufruf gelungen ist, wäre eine Quittung für
         * Ereignisse, die es nicht gibt — und die Tagesquote zählte falsch mit.
         */
        const { events, errors, reactions_count } = resp.data;
        for (const signal of taking.slice(0, events.length)) {
          intakeState.toEvent(signal.id);
          admitted += 1;
        }

        if (errors.length > 0) {
          VelgToast.error(msg(str`${errors.length} could not be admitted`));
        }
        if (leftBehind > 0) {
          VelgToast.info(msg(str`${leftBehind} stay in quarantine – the daily quota is reached.`));
        }
        progress.complete(
          reactions_count > 0
            ? msg(str`${admitted} events, ${reactions_count} reactions`)
            : msg(str`${admitted} events created`),
        );
      },
    );
  } catch (err) {
    captureError(err, { source: 'intake-batch.batchIntegrateQuarantine' });
  }

  return admitted;
}
