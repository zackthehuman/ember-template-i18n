var Addon      = require('ember-cli/lib/models/addon');
var Funnel     = require('broccoli-funnel');
var mergeTrees = require('broccoli-merge-trees');
var existsSync = require('exists-sync');
var logger     = require('heimdalljs-logger')('template-i18n');
var result     = require('lodash.result');
var uniq       = require('lodash.uniq');
var path       = require('path');

/**
 * Collects all addons with a specified name.
 * Walks down the app/addon tree.
 *
 * Returns a list of addon instances with the specified name.
 */
function collectAddons(owner, name) {
  return _collectAddons(owner, name, []);
}

function _collectAddons(owner, name, ret) {
  owner.addons.forEach(function(addon) {
    if (result(addon, 'name') === name) {
      ret.push(addon);
    } else {
      _collectAddons(addon, name, ret);
    }
  });

  return ret;
}

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
  var names = [];
  var target = addon;

  while (target) {
    names.unshift(result(target, 'name'));
    target = target.parent;
  }

  return names.join(' -> ');
}

module.exports = Addon.extend({
  init: function() {
    this._super.init && this._super.init.apply(this, arguments);
    this.treeCache = {};
  },

  isNestedAddon: function() {
    return !!this.parent.parent;
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
    var parentPkg = this.parent.pkg;
    var config = parentPkg['template-i18n'];

    if (config && config.i18nPath) {
      return path.join(this.parent.root, config.i18nPath);
    }

    return path.join(this.parent.root, 'i18n');
  },

  /**
   * The tree containing extracted + translated .properties files.
   */
  _treeForTranslation: function() {
    if (this.treeCache['_treeForTranslation']) {
      return this.treeCache['_treeForTranslation'];
    }

    var trees = [
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

    var i18nPath = path.join(this.parent.root, 'i18n');
    var parentName = this.getParentName();
    var ADDON_TEMPLATES = path.join('addon', 'templates');

    if (existsSync(i18nPath)) {
      logger.info('Found "i18n/" directory in "' + this.parent.root + '"');

      this.treeCache['_treeForTranslatedProperties'] = new Funnel(i18nPath, {
        getDestinationPath: function emberizePath(relativePath) {
          // Move "on-disk" files to their "ember addon" path.
          //
          // From:
          //   addon/templates/components/example-addon-component_en_US.properties
          //
          // To:
          //   modules/<addon-name>/templates/components/example-addon-component_en_US.properties
          //
          if (relativePath.indexOf(ADDON_TEMPLATES) === 0) {
            return path.join(
              'modules',
              parentName,
              relativePath.replace(ADDON_TEMPLATES, 'templates')
            );
          }

          return relativePath;
        }
      });

      return this.treeCache['_treeForTranslatedProperties'];
    } else {
      logger.info('No "i18n/" directory found in "' + this.parent.root + '"');
    }
  },

  _collectTranslationTrees: function() {
    if (this.treeCache['_collectTranslationTrees']) {
      return this.treeCache['_collectTranslationTrees'];
    }

    var trees = collectAddons(this.parent, result(this, 'name'));

    this.treeCache['_collectTranslationTrees'] = trees.map(function(addon) {
      return addon._treeForTranslation();
    });

    return this.treeCache['_collectTranslationTrees'];
  }
});
