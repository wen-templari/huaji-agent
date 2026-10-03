import type { HuajiBotReplyCapture } from './capture.ts';

export interface HuajiBotBindings {
  HUAJIBOT_ALLOWED_DESTINATIONS: string;
  HUAJIBOT_OUTBOUND: Queue<string>;
  HUAJIBOT_REPLY_CAPTURES: DurableObjectNamespace<HuajiBotReplyCapture>;
  HUAJIBOT_REPLY_TRANSPORT: string;
  HUAJIBOT_SIGNING_SECRET: string;
}
