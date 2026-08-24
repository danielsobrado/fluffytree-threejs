import assert from 'node:assert/strict';
import test from 'node:test';
import { ContactShadowField } from '../src/rendering/contact-shadow-field.js';

function resource() {
  return {
    disposed: 0,
    dispose() {
      this.disposed += 1;
    },
  };
}

test('contact shadow shared disposal releases references idempotently', () => {
  const material = resource();
  const texture = resource();
  const field = Object.create(ContactShadowField.prototype);
  field.mesh = null;
  field.material = material;
  field.texture = texture;

  field.disposeShared();
  field.disposeShared();

  assert.equal(material.disposed, 1);
  assert.equal(texture.disposed, 1);
  assert.equal(field.material, null);
  assert.equal(field.texture, null);
});
