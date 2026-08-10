import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { load } from 'js-yaml';

function displayPath(file) {
  return file instanceof URL ? file.pathname : String(file);
}

function parseYamlConfig(source, file) {
  const path = displayPath(file);
  let value;

  try {
    value = load(source);
  } catch (error) {
    throw new Error(`Failed to parse YAML configuration '${path}'.`, {
      cause: error,
    });
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Configuration '${path}' must contain a YAML object.`);
  }

  return value;
}

export function readYamlConfigSync(file) {
  let source;

  try {
    source = readFileSync(file, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read YAML configuration '${displayPath(file)}'.`, {
      cause: error,
    });
  }

  return parseYamlConfig(source, file);
}

export async function readYamlConfig(file) {
  let source;

  try {
    source = await readFile(file, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read YAML configuration '${displayPath(file)}'.`, {
      cause: error,
    });
  }

  return parseYamlConfig(source, file);
}
