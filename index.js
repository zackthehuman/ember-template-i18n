'use strict';

const I18NAddon      = require('./lib/models/i18n-addon');
const ExtractToJson  = require('./lib/broccoli/extract-to-json');
const CombineStrings = require('./lib/broccoli/combine-strings');
const Funnel         = require('broccoli-funnel');
const stew           = require('broccoli-stew');
const mergeTrees     = require('broccoli-merge-trees');
const logger         = require('heimdalljs-logger')('main-i18n');
const path           = require('path');
const result         = require('lodash.result');
const merge          = require('lodash.merge');


const ADDON_NAME      = 'ember-template-i18n';
const PARENT          = 'parent';
const SECRET_REGISTRY = ADDON_NAME + '-secret-registry';
const DEBUG_I18N      = true;

function extractAs(tree, locale) {
  if (tree) {
    return new Funnel(new ExtractToJson([tree]), {
      getDestinationPath: function(relativePath) {
        const dirname = path.dirname(relativePath);
        const basename = path.basename(relativePath, '.hbs');

        return path.join(dirname, basename + '_' + locale + '.properties');
      }
    });
  }
}

function debugLogTree(tree, label) {
  if (DEBUG_I18N) {
    return stew.log(tree, {
      output: 'tree',
      label: label
    });
  }

  return tree;
}

module.exports = merge({}, I18NAddon, {
  name: ADDON_NAME,

  included: function (app) {
    this._super.included.apply(this, arguments);
    this.setupPreprocessorRegistry(SECRET_REGISTRY, this._findHost().registry);
  },

  setupPreprocessorRegistry: function(type, registry) {
    switch(type) {
      case SECRET_REGISTRY:
        this.translationPreprocessorRegistrations(registry);
        break;
      default:
        registry.add('htmlbars-ast-plugin', {
          name: 't-def-remover',
          plugin: require('./lib/handlebars/t-def-remover'),
          baseDir: function() {
            return __dirname;
          }
        });

        registry.add('htmlbars-ast-plugin', {
          name: 't-namespace-inserter',
          plugin: require('./lib/handlebars/t-namespace-inserter'),
          baseDir: function() {
            return __dirname;
          }
        });
        break;
    }
  },

  translationPreprocessorRegistrations: function(registry) {
    this.parentRegistry = registry;

    registry.add(SECRET_REGISTRY, {
      name: '[' + ADDON_NAME + '] extraction for "' + this.getParentName() + '"',
      addon: this
    });
  },

  treeForAddon: function(tree) {
    const thisRoot = this.parent.root;
    const publicTree = this._super.treeForAddon.apply(this, arguments);
    let translationTree;

    if (this.isAppAddon()) {
      const host = this._findHost();
      const hostName = result(host, 'name');
      const pluginWrappers = this.parentRegistry.load(SECRET_REGISTRY);
      const seenAddons = Object.create(null);

      const trees = pluginWrappers.map(function(plugin) {
        this.ui.writeInfoLine('[ember-template-i18n] via ' + plugin.addon.getAddonPathToParent());
        const addonName = plugin.addon.getParentName();
        const addonRoot = plugin.addon.parent.root;
        const pathToAddon = path.relative(thisRoot, addonRoot);

        if (seenAddons[addonName]) {
          this.ui.writeInfoLine(addonName + ' has already been processed for i18n, ignoring duplicate.');
          return;
        } else {
          seenAddons[addonName] = true;
        }

        const movedTrees = [];
        const appTemplates = plugin.addon._treeForParentAppTemplates();

        if (appTemplates) {
          movedTrees.push(
            extractAs(
              new Funnel(appTemplates, {
                destDir: path.join(hostName, 'templates')
              }),
              'en_US'
            )
          );
        }

        const addonTemplates = plugin.addon._treeForParentAddonTemplates();

        if (addonTemplates) {
          movedTrees.push(
            extractAs(
              new Funnel(addonTemplates, {
                destDir: path.join(addonName, 'templates')
              }),
              'en_US'
            )
          );
        }

        const properties = plugin.addon._treeForTranslatedProperties();

        if (properties) {
          const funnelOptions = {
            getDestinationPath: function(relativePath) {
              if (relativePath.indexOf('app/') === 0) {
                return path.join(hostName, relativePath.replace('app/', ''));
              } else if (relativePath.indexOf('addon/') === 0) {
                return path.join(addonName, relativePath.replace('addon/', ''));
              }

              return relativePath;
            }
          };

          if (plugin.addon.isParentAnInRepoAddon()) {
            // This branch covers in-repo addons.
            //
            // In-repo addons complicate things because their source
            // files are in the same repository as their host app. Since
            // translations are based on a repository, we need to account
            // for that and select only the addon's translations files.
            //
            // It selects files from the i18n root based on the in-repo
            // addon's relative path to the host app. It then selects the
            // "app/" and "addon/" directories and maps them the way
            // ember-cli does for template files before compiling them in
            // to modules.
            funnelOptions.srcDir = pathToAddon;
            funnelOptions.include = ['**/*.properties'];
          } else {
            // This branch covers both apps and out-of-repo addons.
            // It selects files from the "app/" and "addon/" directories and
            // maps them the way ember-cli does for template files before
            // compiling them in to modules.
            funnelOptions.include = ['app/**/*.properties', 'addon/**/*.properties'];
          }

          movedTrees.push(new Funnel(properties, funnelOptions));
        }

        const merged = mergeTrees(movedTrees);

        return merged;
      }, this).filter(Boolean);


      if (trees.length) {
        const combined = new CombineStrings(trees);
        const moved = new Funnel(combined, {
          include: ['**/*.js'],
          // Drop the strings into `ember-template-i18n/utils/*.js`
          destDir: path.join(result(this, 'name'), 'utils')
        });

        translationTree = this.preprocessJs(moved, {
          registry: this.registry
        });
      }
    }

    return debugLogTree(
      mergeTrees([translationTree, publicTree].filter(Boolean)),
      'i18n-processed addon tree for ' + this.getParentName()
    );
  }
});
