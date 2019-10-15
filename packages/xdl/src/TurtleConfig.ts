import getenv from 'getenv';

import * as Env from './Env';

let scheme = getenv.string('XDL_SCHEME', 'https');
let host = getenv.string('XDL_HOST', 'exp.host');
let port = getenv.int('XDL_PORT', 0) || null;

if (Env.isStaging()) {
  host = 'staging.exp.host';
} else if (Env.isLocal()) {
  scheme = 'http';
  host = 'localhost';
  port = 3006;
}

interface XDLConfig {
  api: {
    scheme: string;
    host: string;
    port: number | null;
  };
}

const config: XDLConfig = {
  api: {
    scheme,
    host,
    port,
  }
};

export default config;
