import { load } from 'js-yaml';

export class YamlConfigLoader {
  async load(url) {
    const response = await fetch(url, { cache: 'no-cache' });

    if (!response.ok) {
      throw new Error(`Failed to load configuration '${url}': ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    const config = load(text);

    if (!config || typeof config !== 'object') {
      throw new Error(`Configuration '${url}' did not contain an object.`);
    }

    return config;
  }
}
