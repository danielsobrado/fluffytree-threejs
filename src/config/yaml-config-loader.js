import { load } from 'js-yaml';

export class YamlConfigLoader {
  constructor({ fetchImpl = globalThis.fetch } = {}) {
    if (typeof fetchImpl !== 'function') {
      throw new Error('YamlConfigLoader requires a fetch implementation.');
    }
    this.fetchImpl = fetchImpl.bind(globalThis);
  }

  async load(url) {
    let response;
    try {
      response = await this.fetchImpl(url, { cache: 'no-cache' });
    } catch (error) {
      throw new Error(`Failed to fetch configuration '${url}'.`, { cause: error });
    }

    if (!response.ok) {
      throw new Error(
        `Failed to load configuration '${url}': ${response.status} ${response.statusText}`,
      );
    }

    let text;
    try {
      text = await response.text();
    } catch (error) {
      throw new Error(`Failed to read configuration '${url}'.`, { cause: error });
    }

    let config;
    try {
      config = load(text);
    } catch (error) {
      throw new Error(`Failed to parse configuration '${url}'.`, { cause: error });
    }

    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new Error(`Configuration '${url}' did not contain an object.`);
    }

    return config;
  }
}
