import type { StageFactory } from '../scene';
import { createIntro } from './intro';
import { createData } from './data';
import { createPreprocess } from './preprocess';
import { createNetwork } from './network';
import { createPrediction } from './prediction';
import { createXai } from './xai';
import { createMetrics } from './metrics';
import { createSeverity } from './severity';
import { createFinale } from './finale';

/** Stages in story order. Each one declares which chapters it covers. */
export const STAGES: StageFactory[] = [createIntro, createData, createPreprocess, createNetwork, createPrediction, createXai, createMetrics, createSeverity, createFinale];
