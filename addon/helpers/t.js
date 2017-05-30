import Ember from 'ember';

const {
  get,
  observer
} = Ember;

export default Ember.Helper.extend({
  i18n: Ember.inject.service('i18n'),

  compute: function(params) {
    const i18n = get(this, 'i18n');
    const locale = get(i18n, 'interfaceLocale');
    return i18n.getMessage(locale, params[1], params[0]);
  },

  interfaceLocaleChanged: observer('i18n.interfaceLocale', function() {
    this.recompute();
  })
});
