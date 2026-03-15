"use client";

import {
  makeProviders,
  makeSimpleProxyFetcher,
  makeStandardFetcher,
  targets,
} from "@p-stream/providers";
import type { RunOutput } from "@p-stream/providers";

export type { RunOutput };

export function getProviders() {
  return makeProviders({
    fetcher: makeStandardFetcher(fetch),
    proxiedFetcher: makeSimpleProxyFetcher(`${window.location.origin}/api/proxy`, fetch),
    target: targets.BROWSER,
  });
}
