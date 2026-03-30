// URLPattern polyfill — Safari < 18.2 lacks native support.
// Must load before @lit-labs/router (imported by app-shell) which uses URLPattern internally.
import 'urlpattern-polyfill';

import { initSentry } from './services/SentryService.js';

initSentry();

import './app-shell.js';
