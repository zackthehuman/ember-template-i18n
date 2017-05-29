/* jshint node: true */
'use strict';

var Addon         = require('./lib/models/i18n-addon');
var ExtractToJson = require('./lib/broccoli/extract-to-json');
var CombineStrings = require('./lib/broccoli/combine-strings');
var Funnel        = require('broccoli-funnel');
var stew          = require('broccoli-stew');
var mergeTrees    = require('broccoli-merge-trees');
var logger        = require('heimdalljs-logger')('main-i18n');
var path          = require('path');
var result        = require('lodash.result');


var ADDON_NAME      = 'ember-template-i18n';
var PARENT          = 'parent';
var SECRET_REGISTRY = ADDON_NAME + '-secret-registry';

function extractAs(tree, locale) {
  if (tree) {
    return new Funnel(new ExtractToJson([tree]), {
      getDestinationPath: function(relativePath) {
        var dirname = path.dirname(relativePath);
        var basename = path.basename(relativePath, '.hbs');

        return path.join(dirname, basename + '_' + locale + '.properties');
      }
    });
  }
}

module.exports = Addon.extend({
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

  parentPreprocessorRegistrations: function(registry) {
    if (this.isAppAddon()) {
      logger.info('inside of an app: ', this.getParentName(), '\n');
    } else {
      logger.info('inside of another addon: ', this.getParentName(), '\n');
    }

    registry.add('template', {
      name: '[' + ADDON_NAME + '] templates for "' + this.getParentName() + '"',
      ext: 'hbs',
      _addon: this,

      toTree: function(tree) {
        this._addon._treeForExtraction = new ExtractToJson([tree]);
        return tree;
      }
    });
  },

  selfPreprocessorRegistrations: function(registry) {
    registry.add('template', {
      name: '[' + ADDON_NAME + '] templates for (self)',
      ext: 'hbs',
      _addon: this,

      toTree: function(tree) {
        this._addon._treeForSelfExtraction = stew.log(new ExtractToJson([tree]), { output: 'tree', label: 'self extraction for ' + this.getParentName() });
        return tree;
      }
    });
  },

  treeForAddon: function(tree) {
    var thisRoot = this.parent.root;
    var publicTree = this._super.treeForAddon.apply(this, arguments);
    var translationTree;

    if (this.isAppAddon()) {
      var host = this._findHost();
      var hostName = result(host, 'name');
      var pluginWrappers = this.parentRegistry.load(SECRET_REGISTRY);
      var seenAddons = Object.create(null);

      var trees = pluginWrappers.map(function(plugin) {
        this.ui.writeInfoLine(plugin.addon.getAddonPathToParent());
        var addonName = plugin.addon.getParentName();
        var addonRoot = plugin.addon.parent.root;
        var pathToAddon = path.relative(thisRoot, addonRoot);

        if (seenAddons[addonName]) {
          this.ui.writeInfoLine(addonName + ' has already been processed for i18n, ignoring duplicate.');
          return;
        } else {
          seenAddons[addonName] = true;
        }

        var movedTrees = [];
        var appTemplates = plugin.addon._treeForParentAppTemplates();

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

        var addonTemplates = plugin.addon._treeForParentAddonTemplates();

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

        var properties = plugin.addon._treeForTranslatedProperties();

        if (properties) {
          var funnelOptions = {
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

        var merged = mergeTrees(movedTrees);

        return merged;
        //return stew.log(plugin.addon._treeForTranslation(), { output: 'tree', label: plugin.addon.getParentName() });
      }, this).filter(Boolean);


      if (trees.length) {
        const combined = new CombineStrings(trees);

        trees = mergeTrees(trees.concat(combined), { overwrite: true });
        translationTree = this.preprocessJs(new Funnel(trees, {
          include: ['**/*.js'],
          destDir: path.join(result(this, 'name'), 'utils')
        }), {
          registry: this.registry
        });
      }
    }

    return stew.log(
      mergeTrees([translationTree, publicTree].filter(Boolean)),
      {
        output: 'tree',
        label: 'addon tree'
      }
    );
  }
});
