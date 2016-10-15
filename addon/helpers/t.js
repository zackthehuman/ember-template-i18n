import Ember from 'ember';

export function translate(params) {
  const key = params[0];
  return `t(${key})`;
}

export default Ember.Helper.helper(translate);
