/**
 * Minimal ambient type declarations for the Google Cast CAF Sender SDK.
 * Full types are available via @types/chromecast-caf-sender if desired.
 */

declare namespace chrome.cast {
  const AutoJoinPolicy: {
    ORIGIN_SCOPED: string;
    TAB_AND_ORIGIN_SCOPED: string;
    PAGE_SCOPED: string;
  };

  namespace media {
    const DEFAULT_MEDIA_RECEIVER_APP_ID: string;

    class MediaInfo {
      constructor(contentId: string, contentType: string);
      metadata: GenericMediaMetadata;
    }

    class GenericMediaMetadata {
      title?: string;
      subtitle?: string;
      images?: Array<{ url: string }>;
    }

    class LoadRequest {
      constructor(mediaInfo: MediaInfo);
      currentTime: number;
      autoplay: boolean;
    }

    interface MediaSession {
      getEstimatedTime(): number;
    }
  }
}

declare namespace cast.framework {
  const CastContextEventType: {
    SESSION_STATE_CHANGED: string;
    CAST_STATE_CHANGED: string;
  };

  const SessionState: {
    SESSION_STARTED: string;
    SESSION_RESUMED: string;
    SESSION_STARTING: string;
    SESSION_ENDED: string;
    SESSION_END_FAILED: string;
    SESSION_START_FAILED: string;
    NO_SESSION: string;
  };

  interface SessionStateEventData {
    sessionState: string;
  }

  interface CastSession {
    loadMedia(request: chrome.cast.media.LoadRequest): Promise<void>;
    endSession(stopCasting: boolean): Promise<void>;
    getMediaSession(): chrome.cast.media.MediaSession | null;
  }

  class CastContext {
    static getInstance(): CastContext;
    setOptions(options: {
      receiverApplicationId: string;
      autoJoinPolicy: string;
    }): void;
    requestSession(): Promise<void>;
    getCurrentSession(): CastSession | null;
    addEventListener(event: string, handler: (event: SessionStateEventData) => void): void;
    removeEventListener(event: string, handler: (event: SessionStateEventData) => void): void;
  }
}
