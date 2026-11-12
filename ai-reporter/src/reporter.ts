import NodeCache from 'node-cache';
import { randomUUID } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { config } from './config';
import { fetchBackendContext } from './fetchers/backend.fetcher';
import { fetchNews } from './fetchers/news.fetcher';
import { loadPlaybook } from './playbook/loader';
import { buildSystemPrompt, buildUserMessage } from './ai/prompt';
import { callClaude, classifyNewsWithHaiku } from './ai/claude.client';
import type { ReporterReport, NewsItem, PairAnalysis } from './types';

const cache = new NodeCache({ stdTTL: config.reportCacheTtl });
const PERSIST_DIR = join(__dirname, '..', 'data');
const PERSIST_FILE = join(PERSIST_DIR, 'last-report.json');

function loadPersistedReport(): ReporterReport | null {
  try {
    if (!existsSync(PERSIST_FILE)) return null;
    const raw = readFileSync(PERSIST_FILE, 'utf-8');
    const report: ReporterReport = JSON.parse(raw);
    const age = Date.now() - new Date(report.generatedAt).getTime();
    // Only use persisted report if younger than cache TTL
    if (age < config.reportCacheTtl * 1000) {
      console.log(`[CACHE] Loaded persisted report from disk (age: ${Math.round(age / 60000)}m)`);
      return report;
    }
    console.log(`[CACHE] Persisted report is stale (age: ${Math.round(age / 60000)}m), will regenerate`);
    return null;
  } catch {
    return null;
  }
}

function persistReport(report: ReporterReport): void {
  try {
    if (!existsSync(PERSIST_DIR)) mkdirSync(PERSIST_DIR, { recursive: true });
    writeFileSync(PERSIST_FILE, JSON.stringify(report, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[CACHE] Failed to persist report to disk:', (err as any).message);
  }
}

export class Reporter {
  private isGenerating = false;

  async generateReport(forceRefresh = false): Promise<ReporterReport> {
    // 1. In-memory cache
    const cached = cache.get<ReporterReport>('report');
    if (cached && !forceRefresh) return cached;

    // 2. Disk persistence — survives server restarts
    if (!forceRefresh) {
      const persisted = loadPersistedReport();
      if (persisted) {
        cache.set('report', persisted);
        return persisted;
      }
    }

    // Prevent duplicate concurrent generations
    if (this.isGenerating) {
      if (cached) return cached;
      // Return degraded report while generating
      return {
        generatedAt: new Date().toISOString(),
        reportId: randomUUID(),
        environment: {
          riskEnvironment: 'neutral',
          usdBias: 'neutral',
          liquidityRegime: 'neutral',
          centralBankBias: 'neutral',
          dangerZoneActive: false,
        },
        executiveSummary: 'Report is being generated... Please refresh in a moment.',
        marketBias: 'NEUTRAL',
        pairs: [],
        topOpportunity: null,
        topWatch: null,
        newsHeadlines: [],
        playbookFilesLoaded: [],
        modelUsed: 'claude-sonnet-4-6',
        inputTokens: 0,
        outputTokens: 0,
      };
    }

    this.isGenerating = true;

    try {
      // Fetch all data in parallel
      const [context, news] = await Promise.all([
        fetchBackendContext(),
        fetchNews(),
      ]);

      // Load playbook
      const playbookDir = join(__dirname, '..', 'playbook');
      const { content: playbookContent, fileNames: playbookFiles } = await loadPlaybook(playbookDir);

      // Pre-classify news with Haiku (fast + cheap) before main Sonnet call
      const classifiedNews = await classifyNewsWithHaiku(news);

      // Build prompts
      const systemPrompt = buildSystemPrompt(playbookContent);
      const userMessage = buildUserMessage(context, classifiedNews);

      // Call Claude Sonnet for full Decision Matrix analysis
      const { content, inputTokens, outputTokens } = await callClaude(systemPrompt, userMessage);

      // Parse JSON response
      let report: ReporterReport;
      try {
        // Fix invalid +N numbers (not valid JSON, but Claude sometimes emits them)
        const jsonStr = content.replace(/:\s*\+(\d)/g, ': $1');
        report = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('[Reporter] Failed to parse Claude response as JSON:', (parseError as Error).message);
        console.error('[Reporter] Raw content length:', content.length);
        console.error('[Reporter] Raw content (first 1000 chars):\n', content.substring(0, 1000));
        console.error('[Reporter] Raw content (last 200 chars):\n', content.substring(content.length - 200));
        // Degraded report — DO NOT include the raw JSON fragment in executiveSummary
        // (it previously caused the bad content to be persisted and re-served)
        report = {
          generatedAt: new Date().toISOString(),
          reportId: randomUUID(),
          environment: {
            riskEnvironment: context.macro?.riskEnvironment || 'neutral',
            usdBias: context.macro?.usdBias || 'neutral',
            liquidityRegime: context.fred?.liquidityRegime || 'neutral',
            centralBankBias: context.fred?.centralBankBias || 'neutral',
            dangerZoneActive: context.calendar?.dangerZoneActive || false,
          },
          executiveSummary: 'Report generation encountered a parse error. Check server logs for details. Click Refresh to retry.',
          marketBias: 'NEUTRAL',
          pairs: [],
          topOpportunity: null,
          topWatch: null,
          newsHeadlines: news,
          playbookFilesLoaded: playbookFiles,
          modelUsed: 'claude-sonnet-4-6',
          inputTokens,
          outputTokens,
        };
        // Do NOT persist a degraded report — let it regenerate fresh next time
        this.isGenerating = false;
        return report;
      }

      // Enrich with metadata
      report.generatedAt = new Date().toISOString();
      report.reportId = randomUUID();
      report.newsHeadlines = news;
      report.playbookFilesLoaded = playbookFiles;
      report.modelUsed = 'claude-sonnet-4-6';
      report.inputTokens = inputTokens;
      report.outputTokens = outputTokens;

      // Cache in memory and persist to disk
      cache.set('report', report);
      persistReport(report);
      return report;
    } catch (error) {
      console.error('Report generation error:', error);
      throw error;
    } finally {
      this.isGenerating = false;
    }
  }

  getLastReport(): ReporterReport | null {
    return cache.get<ReporterReport>('report') ?? null;
  }

  invalidateCache(): void {
    cache.del('report');
  }
}

export const reporter = new Reporter();
