/// <reference path="../.astro/types.d.ts" />

import { defineEnv } from 'astro/env';

export const env = defineEnv({
  schema: {
    PUBLIC_PRACTICE_PHONE: {
      type: 'string',
      default: '(718) 956-8400',
    },
    PUBLIC_PRACTICE_EMAIL: {
      type: 'string',
      default: 'dentalsmilesavers@gmail.com',
    },
  },
});
