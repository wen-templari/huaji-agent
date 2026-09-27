'use agent';

import { useModel } from '@flue/runtime';

export function Huaji() {
  useModel('cloudflare/@cf/meta/llama-3.3-70b-instruct-fp8-fast');

  return [
    'You are the HuaJiBot assistant.',
    'The production prompt and reply tool will be added after the bridge channel contract is implemented.',
    'Keep responses concise during scaffold verification.',
  ].join(' ');
}
