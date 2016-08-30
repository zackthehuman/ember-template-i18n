var Addon      = require('ember-cli/lib/models/addon');
var Funnel     = require('broccoli-funnel');
var mergeTrees = require('broccoli-merge-trees');
var existsSync = require('exists-sync');
var result     = require('lodash.result');
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
  return new Funnel(tree, {
    getDestinationPath: function(relativePath) {
      return relativePath.replace(/\.hbs$/, '_' + locale + '.properties');
    }
  });
}

module.exports = Addon.extend({
  isNestedAddon: function() {
    return !!this.parent.parent;
  },

  getParentName: function() {
    return result(this.parent, 'name');
  },

  /**
   * The tree containing extracted + translated .properties files.
   */
  _treeForTranslation: function() {
    var trees = [
      extractStringsForTranslation(this._treeForExtraction, 'en_US'),
      this._treeForTranslatedProperties()
    ].filter(Boolean);

    return mergeTrees(trees);
  },

  _treeForTranslatedProperties: function() {
    var i18nPath = path.join(this.parent.root, 'i18n');
    var parentName = this.getParentName();
    var ADDON_TEMPLATES = path.join('addon', 'templates');

    if (existsSync(i18nPath)) {
      console.log('Found "i18n/" directory in "' + this.parent.root + '"');
      return new Funnel(i18nPath, {
        getDestinationPath: function(relativePath) {
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
    } else {
      console.log('No "i18n/" directory found in "' + this.parent.root + '"');
    }
  },

  _collectTranslationTrees: function() {
    var trees = collectAddons(this.parent, result(this, 'name'));
    var selfIndex = trees.indexOf(this);

    if (selfIndex !== -1) {
      trees.splice(selfIndex, 1);
    }

    return trees.map(function(addon) {
      return addon._treeForTranslation();
    });
  }
});
