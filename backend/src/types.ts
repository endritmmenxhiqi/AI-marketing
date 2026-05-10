export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type JobStage =
  | 'queued'
  | 'writing-script'
  | 'finding-media'
  | 'generating-voice'
  | 'generating-image'
  | 'rendering-video'
  | 'uploading-assets'
  | 'completed'
  | 'failed';

export type JobOutputMode = 'video' | 'image';

export type CreativeStyle = 'energetic' | 'luxury' | 'minimal' | 'cinematic';

export type MediaKind = 'video' | 'image' | 'generated-image';

export interface ScriptScene {
  sceneNumber: number;
  headline: string;
  voiceover: string;
  onScreenText: string[];
  pexelsKeywords: string[];
  visualBrief: string;
  imagePrompt: string;
}

export interface ContentPackage {
  socialCaption: string;
  hashtagSuggestions: string[];
}

export interface ScriptPackage {
  title: string;
  hook: string;
  cta: string;
  hashtags: string[];
  musicMood: string;
  scenes: ScriptScene[];
  contentPackage: ContentPackage;
}

export interface MediaCandidate {
  kind: MediaKind;
  source: 'pexels' | 'replicate' | 'stability' | 'upload' | 'pika';
  externalId?: string;
  url: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
  duration?: number;
  attribution?: string;
  query: string;
  localPath?: string;
  selectionScore?: number;
  selectionReason?: string;
}

export interface WordAlignment {
  text: string;
  start: number;
  end: number;
}

export interface CaptionCue {
  text: string;
  start: number;
  end: number;
}

export interface VoiceSegmentResult {
  text: string;
  path: string;
  duration: number;
  alignment: WordAlignment[];
  captions: CaptionCue[];
}

export interface StorageAsset {
  provider: string;
  key: string;
  url: string;
  localPath?: string;
}

export interface SceneRenderPlan {
  index: number;
  scene: ScriptScene;
  media: MediaCandidate;
  voice: VoiceSegmentResult;
  totalDuration: number;
}

export interface JobProgressPayload {
  status: JobStatus;
  stage: JobStage;
  progress: number;
  message: string;
  error?: string;
  imageUrl?: string;
  videoUrl?: string;
  previewUrl?: string;
  trimUrl?: string;
}
