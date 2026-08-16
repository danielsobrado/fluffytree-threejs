import { validateTreeIr } from '../generation/tree-ir-validator.js';
import { TREE_RENDER_REPRESENTATION_ROLES } from '../rendering/tree-representation-role.js';
import { createRepresentationCacheKey, TREE_REPRESENTATION_COMPILER_VERSION } from './tree-cache-key.js';
import { FoliagePrimitiveCompiler } from './foliage-primitive-compiler.js';

function requireRole(role) {
  if (!TREE_RENDER_REPRESENTATION_ROLES.includes(role)) {
    throw new Error(`Unsupported tree representation role '${role}'.`);
  }
  return role;
}

function requireProfileRole(qualityProfile, role) {
  const value = qualityProfile?.representations?.[role];
  if (!value) {
    throw new Error(`Tree quality profile is missing representation '${role}'.`);
  }
  return value;
}

function compileStemPlan(treeIr, maximumStemOrder) {
  const stems = treeIr.stems.filter(
    (stem) => maximumStemOrder === null || stem.order <= maximumStemOrder,
  );
  return Object.freeze({
    sourceStemCount: treeIr.stems.length,
    compiledStemCount: stems.length,
    stemIds: Object.freeze(stems.map((stem) => stem.id)),
  });
}

function compileCrownPlan(treeIr, density) {
  return Object.freeze({
    requestedDensity: density,
    sourceVolumeCount: treeIr.crownVolumes.length,
    crownVolumeIds: Object.freeze(treeIr.crownVolumes.map((volume) => volume.id)),
  });
}

function freezeArtifact(artifact) {
  Object.freeze(artifact.metrics);
  Object.freeze(artifact);
  return artifact;
}

export class TreeRepresentationCompiler {
  constructor({
    foliageCompiler = new FoliagePrimitiveCompiler(),
    compilerVersion = TREE_REPRESENTATION_COMPILER_VERSION,
  } = {}) {
    this.foliageCompiler = foliageCompiler;
    this.compilerVersion = compilerVersion;
  }

  compile(treeIr, role, qualityProfile) {
    validateTreeIr(treeIr);
    requireRole(role);
    const roleProfile = requireProfileRole(qualityProfile, role);
    const structure = compileStemPlan(treeIr, roleProfile.maximumStemOrder);
    const foliage = this.foliageCompiler.compile(treeIr, role, {
      density: roleProfile.foliageDensity,
    });
    const crown = compileCrownPlan(treeIr, roleProfile.crownVolumeDensity);
    const cacheKey = createRepresentationCacheKey({
      treeIr,
      role,
      qualityProfile,
      compilerVersion: this.compilerVersion,
    });

    return freezeArtifact({
      compilerVersion: this.compilerVersion,
      cacheKey,
      role,
      presetId: treeIr.presetId,
      generationModel: treeIr.generationModel,
      seed: treeIr.seed,
      bounds: treeIr.bounds,
      structure,
      foliage,
      crown,
      metrics: {
        sourceStemCount: treeIr.stems.length,
        compiledStemCount: structure.compiledStemCount,
        sourceFoliageSiteCount: treeIr.foliageSites.length,
        foliageBatchCount: foliage.length,
        crownVolumeCount: treeIr.crownVolumes.length,
      },
    });
  }
}
