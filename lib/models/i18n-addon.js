'use strict';

const Funnel       = require('broccoli-funnel');
const mergeTrees   = require('broccoli-merge-trees');
const UnwatchedDir = require('broccoli-source').UnwatchedDir;
const existsSync   = require('exists-sync');
const logger       = require('heimdalljs-logger')('template-i18n');
const result       = require('lodash.result');
const uniq         = require('lodash.uniq');
const path         = require('path');

function extractStringsForTranslation(tree, locale) {
  if (tree) {
    return new Funnel(tree, {
      getDestinationPath: function(relativePath) {
        return relativePath.replace(/\.hbs$/, '_' + locale + '.properties');
      }
    });
  }
}

function getAddonPathToParent(addon) {
  const names = [];
  let target = addon;

  while (target) {
    names.unshift(result(target, 'name'));
    target = target.parent;
  }

  return names.join(' -> ');
}

module.exports = {
  getAddonPathToParent: function() {
    return getAddonPathToParent(this);
  },

  init: function() {
    this._super.init && this._super.init.apply(this, arguments);
    this.treeCache = {};
  },

  /**
   * Determines if this addon instance is the child of another Addon or not.
   * @return {Boolean}
   */
  isNestedAddon: function() {
    return !!this.parent.parent;
  },

  /**
   * Determines if this addon instance is the child of an Application or not.
   * @return {Boolean}
   */
  isAppAddon: function() {
    return !this.isNestedAddon();
  },

  /**
   * Determines if this addon instance is the child of the dummy app.
   * @return {Boolean}
   */
  isDummyAddon: function() {
    return this.app ? result(this.app.options, 'name') === 'dummy' : false;
  },

  isParentAnInRepoAddon: function() {
    const parent = this.parent;
    const parentRoot = parent.root;
    const grandparent = parent.parent;
    let result = false;

    if (grandparent) {
      const pkg = grandparent.pkg;

      if (pkg) {
        const addonConfig = pkg['ember-addon'];

        if (addonConfig) {
          if (addonConfig.paths) {
            addonConfig.paths.forEach(function(relativePath) {
              const addonPath = path.join(grandparent.root, relativePath);

              if (addonPath === parentRoot) {
                result = true;
              }
            });
          }
        }
      }
    }

    return result;
  },

  getParentName: function() {
    return result(this.parent, 'name');
  },

  /**
   * Gets the parent's "i18n path", which is the path where translations can
   * be found. The path is relative to the parent's project root.
   *
   * If no i18n path is configured, the path is assumed to be "i18n/", relative
   * to the parent's project root.
   *
   * @return {string}
   */
  getParentI18nPath: function() {
    const parentPkg = this.parent.pkg;
    const config = parentPkg['template-i18n'];

    if (config && config.i18nPath) {
      return path.join(this.parent.root, config.i18nPath);
    }

    return path.join(this.parent.root, 'i18n');
  },

  _treeForParentAppTemplates: function() {
    const templatePath = this.isDummyAddon()
      ? path.join(this.parent.root, 'tests', 'dummy', 'app', 'templates')
      : path.join(this.parent.root, 'app', 'templates');

    if (existsSync(templatePath)) {
      logger.debug('(_treeForParentAppTemplates) path:', templatePath, 'exists!');
      return new Funnel(templatePath, {
        include: ['**/*.hbs']
      });
    } else {
      logger.debug('(_treeForParentAppTemplates) path:',templatePath, 'doesn\'t exist!');
    }
  },

  _treeForParentAddonTemplates: function() {
    const templatePath = this.isDummyAddon()
      ? path.join(this.parent.root, 'tests', 'dummy', 'addon', 'templates')
      : path.join(this.parent.root, 'addon', 'templates');

    if (existsSync(templatePath)) {
      logger.debug('(_treeForParentAddonTemplates) path:', templatePath, 'exists!');
      return new Funnel(templatePath, {
        include: ['**/*.hbs']
      });
    } else {
      logger.debug('(_treeForParentAddonTemplates) path:', templatePath, 'doesn\'t exist!');
    }
  },

  /**
   * The tree containing extracted + translated .properties files.
   */
  _treeForTranslation: function() {
    if (this.treeCache['_treeForTranslation']) {
      return this.treeCache['_treeForTranslation'];
    }

    const trees = [
      extractStringsForTranslation(this._treeForExtraction, 'en_US'),
      this._treeForTranslatedProperties()
    ].filter(Boolean);

    logger.trace(getAddonPathToParent(this));

    this.treeCache['_treeForTranslation'] = mergeTrees(trees);

    return this.treeCache['_treeForTranslation'];
  },

  _treeForTranslatedProperties: function() {
    if (this.treeCache['_treeForTranslatedProperties']) {
      return this.treeCache['_treeForTranslatedProperties'];
    }

    const i18nPath = this.getParentI18nPath();
    const parentName = this.getParentName();
    const ADDON_TEMPLATES = path.join('addon', 'templates');

    if (existsSync(i18nPath)) {
      logger.info('Found "i18n/" directory in "' + this.parent.root + '"');

      this.treeCache['_treeForTranslatedProperties'] = new UnwatchedDir(i18nPath);

      return this.treeCache['_treeForTranslatedProperties'];
    } else {
      logger.info('No "i18n/" directory found in "' + this.parent.root + '"');
    }
  }
};
