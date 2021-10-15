const request = require('@magic-cli-dev/request');

module.exports = function () {
  return request({
    url: '/project/template',
  })
}