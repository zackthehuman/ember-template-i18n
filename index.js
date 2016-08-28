/* jshint node: true */
'use strict';

var Funnel = require('broccoli-funnel');
var stew = require('broccoli-stew');
var mergeTrees = require('broccoli-merge-trees');
var path = require('path');
var existsSync = require('exists-sync');
var uniq = require('lodash.uniq');
var result = require('lodash.result');

module.exports = {
  name: 'ember-template-i18n',

  isNestedAddon: function() {
    return !!this.parent.parent;
  },

  getParentName: function() {
    return result(this.parent, 'name');
  },

  // preprocessTree: function(name, tree) {
  //   if (name === 'template') {
  //     return stew.log(tree, { output: 'tree', label: 'preprocessTree - template' });
  //   }

  //   return tree;
  // },

  setupPreprocessorRegistry: function(type, registry) {
    if (type === 'parent') {
      if (this.isNestedAddon()) {
        console.log('inside of another addon: ', this.getParentName(), '\n');
      } else {
        console.log('inside of an app: ', this.getParentName(), '\n');
      }

      registry.add('template', {
        name: '[ember-template-i18n] extraction for "' + this.getParentName() + '"',
        ext: 'hbs',
        _addon: this,

        toTree: function(tree) {
          this._addon._translationTemplates = tree;

          return stew.log(tree, {
            output: 'tree',
            label: 'preprocess - ' + type + ' - template / ' + this._addon.getParentName()
          });
        }
      });
    }
  },

  treeForPublic: function(tree) {
    var publicTree = this._super.treeForPublic.apply(this, arguments);
    var trees = [publicTree, this._translationTemplates, this._treeForTranslation()].filter(Boolean);

    if (!this.isNestedAddon()) {
      // When this addon is the child of an app, it has to find any other instances
      // of itself (which were included in other addons) and get their trees for translation.
      var i18nAddons = collectAddons(this.parent, result(this, 'name'));
      var i18nTrees = mergeTrees(this._collectTranslationTrees());

      trees.push(new Funnel(i18nTrees, {
        destDir: 'properties'
      }));
    }

    if (trees.length) {
      return new Funnel(mergeTrees(trees), {
        destDir: 'i18n'
      });
    }

    return publicTree;
  },

  // treeForApp: function(tree) {
  //   var appTree = this._super.treeForApp.apply(this, arguments);

  //   if (!this.isNestedAddon()) {
  //     return stew.log(appTree, { output: 'tree', label: 'app tree' });
  //   }

  //   return appTree;
  // },

  /**
   * The tree containing translated .properties files.
   */
  _treeForTranslation: function() {
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
    var trees = uniq(collectAddons(this.parent, result(this, 'name')));

    return trees.map(function(addon) {
      var trees = [
        addon._translationTemplates, // templates that need to be translated
        addon._treeForTranslation()  // translated .properties files
      ].filter(Boolean);

      console.log(trees.length);

      return mergeTrees(trees);
    });
  }
};


function collectAddons(owner, name, ret) {
  ret = ret || [];

  var notSelfAddons = owner.addons.filter(function(addon) {
    return result(addon, 'name') !== name;
  });

  notSelfAddons.forEach(function(addon) {
    addon.addons.forEach(function(childAddon) {
      if (result(childAddon, 'name') === name) {
        ret.push(childAddon);
      }

      collectAddons(addon, name, ret);
    });
  });

  return ret;
}
