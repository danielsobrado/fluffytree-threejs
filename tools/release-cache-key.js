import yaml from 'js-yaml';

function requireString(config, key) {
  const value = config?.[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing non-empty release configuration value: ${key}`);
  }
  return value.trim();
}

export function releaseCacheKeyFromYaml(source) {
  const release = yaml.load(source);
  if (!release || typeof release !== 'object' || Array.isArray(release)) {
    throw new Error('Release configuration must contain a YAML object.');
  }

  return `${requireString(release, 'version')}-${requireString(release, 'build')}`;
}
